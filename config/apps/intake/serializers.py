"""
DRF serializers for IntakeSession, Message, and ClinicalBrief.
"""
from rest_framework import serializers
from .models import IntakeSession, Message, ClinicalBrief


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id',
            'role',
            'content',
            'timestamp',
            'was_transcribed',
        ]
        read_only_fields = ['id', 'timestamp']


class ClinicalBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalBrief
        fields = [
            'id',
            'generated_at',
            'chief_complaint',
            'hpi',
            'ros',
            'raw_text',
        ]
        read_only_fields = fields


class IntakeSessionSerializer(serializers.ModelSerializer):
    """Full session including all messages and the brief (if generated)."""
    messages = MessageSerializer(many=True, read_only=True)
    brief    = ClinicalBriefSerializer(read_only=True)

    class Meta:
        model = IntakeSession
        fields = [
            'id',
            'created_at',
            'updated_at',
            'current_phase',
            'collected_data',
            'is_complete',
            'messages',
            'brief',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'current_phase',
            'collected_data',
            'is_complete',
        ]


class IntakeSessionListSerializer(serializers.ModelSerializer):
    """Lighter serializer for listing sessions (no messages, no brief)."""
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = IntakeSession
        fields = [
            'id',
            'created_at',
            'updated_at',
            'current_phase',
            'is_complete',
            'message_count',
        ]

    def get_message_count(self, obj):
        return obj.messages.count()


# ─── Request / Response shapes for the agent endpoints ───────────────────────

class SendMessageSerializer(serializers.Serializer):
    """Body for POST /api/intake/session/{id}/message/"""
    content = serializers.CharField(
        help_text="The patient's message text (already transcribed if voice).",
        max_length=2000,
    )


class TranscribeResponseSerializer(serializers.Serializer):
    """Response shape for POST /api/intake/session/{id}/transcribe/"""
    transcript = serializers.CharField()


class AgentReplySerializer(serializers.Serializer):
    """
    What the agent endpoint returns after processing a patient message.
    """
    reply          = serializers.CharField(help_text="Agent's next question or acknowledgement.")
    current_phase  = serializers.CharField()
    is_complete    = serializers.BooleanField()
    collected_data = serializers.DictField(help_text="Running structured data collected so far.")
    message        = MessageSerializer(help_text="The saved agent Message object.")