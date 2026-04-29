"""
Brief generator — takes a completed session's collected_data and
produces a structured ClinicalBrief via GPT-4o.
"""
import json
import logging
import requests

from django.conf import settings

from .prompts import BRIEF_GENERATOR_SYSTEM
from ..models import ClinicalBrief

logger = logging.getLogger(__name__)


def generate_clinical_brief(session) -> ClinicalBrief:
    """
    Call GPT-4o to convert collected_data into a structured ClinicalBrief.

    Creates (or replaces) the ClinicalBrief row linked to this session.

    Returns
    ───────
    ClinicalBrief instance (already saved to the DB)

    Raises
    ──────
    ValueError   — model returned malformed JSON
    openai.APIError — propagated up
    """
    user_prompt = (
        "Here is the completed intake data. Generate the clinical brief.\n\n"
        + json.dumps(session.collected_data, indent=2)
    )

    logger.debug("Generating brief for session %s", session.id)

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": BRIEF_GENERATOR_SYSTEM},
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            },
            timeout=90
        )
        response.raise_for_status()
        data = response.json()
        raw = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        raise ValueError(f"Groq brief generation error: {exc}")

    logger.debug("Brief generator raw output: %s", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Brief generator returned invalid JSON: {exc}") from exc

    # Upsert — delete existing brief if one already exists (e.g. re-generate)
    ClinicalBrief.objects.filter(session=session).delete()

    brief = ClinicalBrief.objects.create(
        session=session,
        chief_complaint=data.get('chief_complaint', ''),
        hpi=data.get('hpi', {}),
        ros=data.get('ros', {}),
        raw_text=data.get('raw_text', ''),
    )

    logger.info("ClinicalBrief %s created for session %s", brief.id, session.id)
    return brief