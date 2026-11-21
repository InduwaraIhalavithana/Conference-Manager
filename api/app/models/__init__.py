from beanie import Document

from app.models.conference import Conference, LocalizedText

DOCUMENT_MODELS: list[type[Document]] = [Conference]

__all__ = ["DOCUMENT_MODELS", "Conference", "LocalizedText"]
