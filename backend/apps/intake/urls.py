"""
URL patterns for the intake app.
All routes are mounted at /api/intake/ in config/urls.py.
"""
from django.urls import path
from . import views

app_name = 'intake'

urlpatterns = [
    # ── Session CRUD ───────────────────────────────────────────────────────
    # POST   /api/intake/sessions/        → create new session
    # GET    /api/intake/sessions/        → list sessions
    path(
        'sessions/',
        views.SessionListCreateView.as_view(),
        name='session-list-create',
    ),

    # GET    /api/intake/sessions/<id>/   → session detail with all messages
    # DELETE /api/intake/sessions/<id>/   → delete session
    path(
        'sessions/<uuid:session_id>/',
        views.SessionDetailView.as_view(),
        name='session-detail',
    ),

    # ── Agent interaction ──────────────────────────────────────────────────
    # POST   /api/intake/sessions/<id>/message/
    #        Body: { "content": "..." }
    #        → saves patient message, returns agent reply
    path(
        'sessions/<uuid:session_id>/message/',
        views.SendMessageView.as_view(),
        name='send-message',
    ),

    # POST   /api/intake/sessions/<id>/transcribe/
    #        multipart/form-data  field: audio (file)
    #        → transcribes audio, saves both messages, returns agent reply
    path(
        'sessions/<uuid:session_id>/transcribe/',
        views.TranscribeAudioView.as_view(),
        name='transcribe-audio',
    ),

    # ── Brief ──────────────────────────────────────────────────────────────
    # POST   /api/intake/sessions/<id>/generate-brief/
    #        → generates and saves ClinicalBrief
    path(
        'sessions/<uuid:session_id>/generate-brief/',
        views.GenerateBriefView.as_view(),
        name='generate-brief',
    ),

    # GET    /api/intake/sessions/<id>/brief/
    #        → retrieve the generated brief
    path(
        'sessions/<uuid:session_id>/brief/',
        views.BriefDetailView.as_view(),
        name='brief-detail',
    ),
]