from django.contrib import admin
from .models import IntakeSession, Message, ClinicalBrief


@admin.register(IntakeSession)
class IntakeSessionAdmin(admin.ModelAdmin):
    list_display  = ['id', 'current_phase', 'is_complete', 'created_at', 'updated_at']
    list_filter   = ['current_phase', 'is_complete']
    readonly_fields = ['id', 'created_at', 'updated_at', 'collected_data']
    ordering      = ['-created_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ['id', 'session', 'role', 'was_transcribed', 'timestamp']
    list_filter   = ['role', 'was_transcribed']
    search_fields = ['content']
    readonly_fields = ['timestamp']
    ordering      = ['session', 'timestamp']


@admin.register(ClinicalBrief)
class ClinicalBriefAdmin(admin.ModelAdmin):
    list_display  = ['id', 'session', 'generated_at']
    readonly_fields = ['generated_at', 'chief_complaint', 'hpi', 'ros', 'raw_text']
    ordering      = ['-generated_at']