"""
Intake agent — drives the conversation through CC → HPI → ROS using Ollama.
"""

import json
import logging
import re
import requests
from django.conf import settings

from .prompts import INTAKE_AGENT_SYSTEM

logger = logging.getLogger(__name__)


def _build_history(session) -> list[dict]:
    history = []
    for msg in session.messages.order_by('timestamp'):
        role = 'assistant' if msg.role == 'agent' else 'user'
        history.append({'role': role, 'content': msg.content})
    return history


def _safe_parse_json(raw_text: str) -> dict:
    try:
        clean = raw_text.replace("```json", "").replace("```", "").strip()
        match = re.search(r"\{.*\}", clean, re.DOTALL)

        if not match:
            raise ValueError("No JSON found")

        return json.loads(match.group())

    except Exception as e:
        logger.error("JSON parsing failed: %s", raw_text)
        raise ValueError(f"Invalid JSON from Ollama: {e}")


def _merge_collected_data(existing: dict, new: dict) -> dict:
    if not existing:
        existing = {"cc": {}, "hpi": {}, "ros": {}}

    for section in ["cc", "hpi", "ros"]:
        existing.setdefault(section, {})
        existing[section].update(new.get(section, {}))

    return existing


def run_intake_agent(session, user_message: str) -> dict:
    # --- Ensure base structure ---
    if not session.collected_data:
        session.collected_data = {"cc": {}, "hpi": {}, "ros": {}}

    # --- Build prompt ---
    system_prompt = INTAKE_AGENT_SYSTEM.format(
        phase=session.current_phase,
        collected_data_json=json.dumps(session.collected_data, indent=2),
        user_message=user_message
    )

    history = _build_history(session)
    history.append({'role': 'user', 'content': user_message})

    # --- Call Groq ---
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
                    {"role": "system", "content": f"{system_prompt}\n\nRespond ONLY in valid JSON."},
                    *history
                ],
                "response_format": {"type": "json_object"}
            },
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        raw_text = data["choices"][0]["message"]["content"].strip()
        print("\nRAW GROQ OUTPUT:\n", raw_text)

    except Exception as exc:
        logger.error("Groq error: %s", exc)
        return {
            "reply": "Sorry, I'm having trouble right now. Please try again.",
            "phase": session.current_phase,
            "is_complete": False,
            "collected_data": session.collected_data
        }

    # --- Parse JSON ---
    try:
        result = _safe_parse_json(raw_text)
    except Exception:
        return {
            "reply": "Sorry, I didn’t understand that. Could you repeat?",
            "phase": session.current_phase,
            "is_complete": False,
            "collected_data": session.collected_data
        }

    # --- Ensure required keys ---
    required_keys = {"reply", "phase", "is_complete", "collected_data"}
    if not all(k in result for k in required_keys):
        logger.error("Missing keys in model response: %s", result)
        return {
            "reply": "Sorry, something went wrong. Can you repeat?",
            "phase": session.current_phase,
            "is_complete": False,
            "collected_data": session.collected_data
        }

    # --- Ensure collected_data structure ---
    if not isinstance(result["collected_data"], dict):
        result["collected_data"] = {"cc": {}, "hpi": {}, "ros": {}}

    result["collected_data"].setdefault("cc", {})
    result["collected_data"].setdefault("hpi", {})
    result["collected_data"].setdefault("ros", {})

    # --- Ensure reply is not empty ---
    if not result.get("reply"):
        result["reply"] = "Can you tell me more about your symptoms?"

    # --- Fix incorrect phase logic ---
    # --- Phase guard — only allow forward movement, never backwards ---
    PHASE_ORDER = ['cc', 'hpi', 'ros', 'done']

    model_phase   = result['phase']   if result['phase']   in PHASE_ORDER else 'cc'
    session_phase = session.current_phase if session.current_phase in PHASE_ORDER else 'cc'

    model_idx   = PHASE_ORDER.index(model_phase)
    session_idx = PHASE_ORDER.index(session_phase)

    # If the model tried to go backwards (e.g. back to hpi from ros), ignore it
    if model_idx < session_idx:
        result['phase'] = session_phase   # keep current phase
    else:
        result['phase'] = model_phase     # accept the model's advancement

    # is_complete only makes sense on 'done'
    if result['phase'] != 'done':
        result['is_complete'] = False

    # --- Merge data ---
    merged_data = _merge_collected_data(
        session.collected_data,
        result["collected_data"]
    )

    # --- Save session ---
    session.current_phase = result["phase"]
    session.collected_data = merged_data
    session.is_complete = result["is_complete"]
    session.save(update_fields=[
        "current_phase",
        "collected_data",
        "is_complete",
        "updated_at"
    ])

    return {
        "reply": result["reply"],
        "phase": result["phase"],
        "is_complete": result["is_complete"],
        "collected_data": merged_data
    }