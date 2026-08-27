DELETE FROM `app_settings` WHERE `key` = 'transcription.provider_credentials';
--> statement-breakpoint
DELETE FROM `app_settings`
WHERE `key` = 'transcription.preferences'
  AND json_valid(`value_json`)
  AND json_extract(`value_json`, '$.providerId') IN ('groq', 'openai', 'elevenlabs', 'gemini');
