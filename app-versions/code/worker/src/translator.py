import argostranslate.package
import argostranslate.translate
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class Translator:
    """Local translation service using Argos Translate."""

    def __init__(self):
        """Initialize translator and ensure models are available."""
        try:
            # Update package index
            argostranslate.package.update_package_index()

            # Get installed packages
            installed_packages = argostranslate.package.get_installed_packages()
            logger.info(f"Installed translation packages: {len(installed_packages)}")

            # Log available language pairs
            for pkg in installed_packages:
                logger.info(f"  {pkg.from_code} -> {pkg.to_code}")

        except Exception as e:
            logger.error(f"Failed to initialize translator: {e}")
            raise

    def translate(self, text: str, source: str, target: str) -> str:
        """
        Translate text from source language to target language.

        Args:
            text: Text to translate
            source: Source language code (e.g., 'en')
            target: Target language code (e.g., 'es')

        Returns:
            Translated text

        Raises:
            ValueError: If language pair is not available
            RuntimeError: If translation fails
        """
        if not text or not text.strip():
            return text

        try:
            # Get translation object
            translation = argostranslate.translate.get_translation_from_codes(
                source, target
            )

            if translation is None:
                error_msg = f"Translation model not available for {source} -> {target}"
                logger.error(error_msg)
                raise ValueError(error_msg)

            # Perform translation
            translated_text = translation.translate(text)

            logger.info(
                f"Translated text ({source} -> {target}): "
                f"{text[:50]}... -> {translated_text[:50]}..."
            )

            return translated_text

        except ValueError:
            raise
        except Exception as e:
            error_msg = f"Translation failed ({source} -> {target}): {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
