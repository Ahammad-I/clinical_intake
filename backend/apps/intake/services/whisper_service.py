# """
# Whisper transcription service.

# Accepts a Django UploadedFile (the raw audio blob from the browser),
# converts it to WAV with ffmpeg, runs Whisper locally, and returns
# the transcript as a plain string.

# Requirements
# ────────────
#   pip install openai-whisper ffmpeg-python
#   # AND the ffmpeg binary on your PATH:
#   #   Ubuntu: sudo apt install ffmpeg
#   #   macOS:  brew install ffmpeg
# """
# import logging
# import os
# import subprocess
# import tempfile

# from django.conf import settings

# logger = logging.getLogger(__name__)

# # Module-level singleton — load once, reuse across requests
# # Models: tiny | base | small | medium | large
# # 'base' is fast and good enough for clear clinical speech
# _whisper_model = None


# def _get_model():
#     global _whisper_model
#     if _whisper_model is None:
#         import whisper
#         model_name = getattr(settings, 'WHISPER_MODEL', 'base')
#         logger.info("Loading Whisper model '%s' (first call only) ...", model_name)
#         _whisper_model = whisper.load_model(model_name)
#         logger.info("Whisper model loaded.")
#     return _whisper_model


# def transcribe_audio(uploaded_file) -> str:
#     """
#     Transcribe an uploaded audio file.

#     Parameters
#     ──────────
#     uploaded_file : Django InMemoryUploadedFile or TemporaryUploadedFile
#         The raw audio sent by the browser (typically webm/opus or mp4).

#     Returns
#     ───────
#     str — the transcribed text, stripped of leading/trailing whitespace.

#     Raises
#     ──────
#     RuntimeError — if ffmpeg conversion fails
#     """
#     # 1. Write the uploaded bytes to a temp file
#     suffix = _get_suffix(uploaded_file.name or 'audio.webm')
#     with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
#         for chunk in uploaded_file.chunks():
#             tmp_in.write(chunk)
#         tmp_in_path = tmp_in.name

#     # 2. Convert to 16 kHz mono WAV (Whisper's preferred format)
#     tmp_wav_path = tmp_in_path.replace(suffix, '.wav')
#     try:
#         result = subprocess.run(
#             [
#                 'ffmpeg', '-y',             # overwrite output if exists
#                 '-i', tmp_in_path,          # input file
#                 '-ar', '16000',             # 16 kHz sample rate
#                 '-ac', '1',                 # mono
#                 '-f', 'wav',                # force wav container
#                 tmp_wav_path,
#             ],
#             capture_output=True,
#             timeout=60,
#         )
#         if result.returncode != 0:
#             err = result.stderr.decode('utf-8', errors='replace')
#             raise RuntimeError(f"ffmpeg conversion failed: {err}")
#     except FileNotFoundError as exc:
#         raise RuntimeError(
#             "ffmpeg not found. Install it: sudo apt install ffmpeg (Linux) "
#             "or brew install ffmpeg (macOS)"
#         ) from exc

#     # 3. Run Whisper
#     try:
#         model = _get_model()
#         transcription = model.transcribe(tmp_wav_path, fp16=False)
#         transcript = transcription['text'].strip()
#         logger.debug("Whisper transcript: %s", transcript)
#         return transcript
#     finally:
#         # 4. Clean up temp files regardless of success/failure
#         for path in (tmp_in_path, tmp_wav_path):
#             try:
#                 os.unlink(path)
#             except FileNotFoundError:
#                 pass


# def _get_suffix(filename: str) -> str:
#     """Return the file extension, defaulting to .webm."""
#     _, ext = os.path.splitext(filename)
#     return ext if ext else '.webm'
"""
Whisper transcription via Groq API (whisper-large-v3).
Replaces the local Whisper model entirely.
No ffmpeg needed. Uses the same GROQ_API_KEY from .env.
"""
import logging
import tempfile
import os

from django.conf import settings
from groq import Groq

logger = logging.getLogger(__name__)


def transcribe_audio(uploaded_file) -> str:
    """
    Transcribe an uploaded audio file using Groq's whisper-large-v3.

    Parameters
    ──────────
    uploaded_file : Django InMemoryUploadedFile or TemporaryUploadedFile
        Raw audio from browser (webm, mp4, wav, m4a all accepted).

    Returns
    ───────
    str — transcribed text, stripped.
    """
    client = Groq(api_key=settings.GROQ_API_KEY)

    # Write to temp file — Groq SDK needs a real file path
    suffix = _get_suffix(uploaded_file.name or 'audio.webm')

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        with open(tmp_path, 'rb') as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model='whisper-large-v3',
                language='en',              # set your language here
                response_format='text',     # returns plain string directly
            )
        transcript = transcription.strip() if isinstance(transcription, str) else transcription.text.strip()
        logger.debug("Groq Whisper transcript: %s", transcript)
        return transcript

    except Exception as exc:
        logger.error("Groq Whisper error: %s", exc)
        raise RuntimeError(f"Transcription failed: {exc}") from exc

    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass


def _get_suffix(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return ext if ext else '.webm'