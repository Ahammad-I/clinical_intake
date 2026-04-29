"""
DRF views for the clinical intake API.

Endpoints
─────────
  POST   /api/intake/sessions/                    — start a new session
  GET    /api/intake/sessions/                    — list all sessions
  GET    /api/intake/sessions/{id}/               — get full session detail
  DELETE /api/intake/sessions/{id}/               — delete a session

  POST   /api/intake/sessions/{id}/message/       — send patient message → get agent reply
  POST   /api/intake/sessions/{id}/transcribe/    — upload audio → get transcript
  POST   /api/intake/sessions/{id}/generate-brief/— generate the ClinicalBrief
  GET    /api/intake/sessions/{id}/brief/         — retrieve the generated brief
"""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .agent.brief_generator import generate_clinical_brief
from .agent.intake_agent import run_intake_agent
from .models import ClinicalBrief, IntakeSession, Message
from .serializers import (
    AgentReplySerializer,
    ClinicalBriefSerializer,
    IntakeSessionListSerializer,
    IntakeSessionSerializer,
    SendMessageSerializer,
)
from .services.whisper_service import transcribe_audio

logger = logging.getLogger(__name__)


# ─── Session CRUD ─────────────────────────────────────────────────────────────

class SessionListCreateView(APIView):
    """
    GET  /api/intake/sessions/  → list all sessions (newest first)
    POST /api/intake/sessions/  → create a new session, save greeting message
    """

    def get(self, request):
        sessions = IntakeSession.objects.all()
        serializer = IntakeSessionListSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Create a fresh session
        session = IntakeSession.objects.create()

        # Save the agent's opening greeting as the first message
        greeting = (
            "Hello! I'm your intake nurse for today. I'll ask you a few questions "
            "to help prepare your doctor before your visit. This usually takes about "
            "3–5 minutes.\n\n"
            "To start — what brings you in today? Please describe your main concern."
        )
        Message.objects.create(
            session=session,
            role='agent',
            content=greeting,
        )

        serializer = IntakeSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SessionDetailView(APIView):
    """
    GET    /api/intake/sessions/{id}/  → full session with messages + brief
    DELETE /api/intake/sessions/{id}/  → delete session and all related data
    """

    def get(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)
        serializer = IntakeSessionSerializer(session)
        return Response(serializer.data)

    def delete(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Agent interaction ────────────────────────────────────────────────────────

class SendMessageView(APIView):
    """
    POST /api/intake/sessions/{id}/message/

    Body: { "content": "I've had chest pain for 3 days" }

    1. Saves the patient's message
    2. Runs it through the GPT-4o intake agent
    3. Saves the agent's reply
    4. Returns both the reply text and updated session state
    """

    def post(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)

        # Validate request body
        serializer = SendMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_content = serializer.validated_data['content'].strip()

        # Guard: don't accept messages after intake is complete
        if session.is_complete:
            return Response(
                {'detail': 'This intake session is already complete. Generate the brief.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Save the patient's message
        Message.objects.create(
            session=session,
            role='user',
            content=user_content,
        )

        # 2. Run the agent
        try:
            agent_result = run_intake_agent(session, user_content)
        except ValueError as exc:
            logger.error("Agent error for session %s: %s", session_id, exc)
            return Response(
                {'detail': f'Agent error: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception("Unexpected agent error for session %s", session_id)
            return Response(
                {'detail': 'An unexpected error occurred. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 3. Save the agent's reply
        agent_message = Message.objects.create(
            session=session,
            role='agent',
            content=agent_result['reply'],
        )

        # 4. Build response
        response_data = {
            'reply':          agent_result['reply'],
            'current_phase':  agent_result['phase'],
            'is_complete':    agent_result['is_complete'],
            'collected_data': agent_result['collected_data'],
            'message': {
                'id':              agent_message.id,
                'role':            agent_message.role,
                'content':         agent_message.content,
                'timestamp':       agent_message.timestamp,
                'was_transcribed': agent_message.was_transcribed,
            },
        }
        return Response(response_data, status=status.HTTP_200_OK)


class TranscribeAudioView(APIView):
    """
    POST /api/intake/sessions/{id}/transcribe/

    multipart/form-data with field 'audio' containing the audio file.

    Runs Whisper locally, saves the audio file and transcript,
    then also runs it through the agent (same as SendMessageView).

    This means the frontend only needs ONE endpoint for voice input.
    """
    parser_classes = [MultiPartParser]

    def post(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response(
                {'detail': 'No audio file provided. Send multipart/form-data with field "audio".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if session.is_complete:
            return Response(
                {'detail': 'Session is already complete.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Transcribe with Whisper
        try:
            transcript = transcribe_audio(audio_file)
        except RuntimeError as exc:
            logger.error("Whisper error for session %s: %s", session_id, exc)
            return Response(
                {'detail': f'Transcription failed: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not transcript:
            return Response(
                {'detail': 'Whisper returned an empty transcript. Please try again.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # 2. Save audio file + transcript as a user Message
        # Re-open the file for storage (it was consumed by Whisper)
        audio_file.seek(0)
        user_message = Message.objects.create(
            session=session,
            role='user',
            content=transcript,
            audio_file=audio_file,
            was_transcribed=True,
        )

        # 3. Run the agent with the transcript
        try:
            agent_result = run_intake_agent(session, transcript)
        except ValueError as exc:
            logger.error("Agent error after transcription, session %s: %s", session_id, exc)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # 4. Save agent reply
        agent_message = Message.objects.create(
            session=session,
            role='agent',
            content=agent_result['reply'],
        )
        return Response({
    'transcript':     transcript,
    'reply':          agent_result['reply'],
    'current_phase':  agent_result['phase'],
    'is_complete':    agent_result['is_complete'],
    'collected_data': agent_result['collected_data'],
    # ← ADD THIS BLOCK — matches what sendMessage returns
    # so applyAgentResponse() in the frontend picks it up
    'message': {
        'id':              agent_message.id,
        'role':            agent_message.role,
        'content':         agent_message.content,
        'timestamp':       agent_message.timestamp,
        'was_transcribed': agent_message.was_transcribed,
    },
}, status=status.HTTP_200_OK)


# ─── Brief generation ─────────────────────────────────────────────────────────

class GenerateBriefView(APIView):
    """
    POST /api/intake/sessions/{id}/generate-brief/

    Triggers GPT-4o to convert collected_data into a structured ClinicalBrief.
    Can also be called to regenerate the brief.

    The session does NOT have to be complete to call this — the clinician
    can request a partial brief at any time.
    """

    def post(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)

        if not session.collected_data:
            return Response(
                {'detail': 'No data collected yet. Start the intake first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            brief = generate_clinical_brief(session)
        except ValueError as exc:
            logger.error("Brief generation error for session %s: %s", session_id, exc)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as exc:
            logger.exception("Unexpected error generating brief for session %s", session_id)
            return Response(
                {'detail': 'Brief generation failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = ClinicalBriefSerializer(brief)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BriefDetailView(APIView):
    """
    GET /api/intake/sessions/{id}/brief/

    Returns the generated ClinicalBrief for this session, or 404 if
    generate-brief has not been called yet.
    """

    def get(self, request, session_id):
        session = get_object_or_404(IntakeSession, pk=session_id)
        brief = get_object_or_404(ClinicalBrief, session=session)
        serializer = ClinicalBriefSerializer(brief)
        return Response(serializer.data)