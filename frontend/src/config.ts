/** Project contact address shown on the About, Contact and footer. */
export const CONTACT_EMAIL = 'admin.conferencehub@gmail.com';

/** Upload limits, kept in step with backend/app/core/uploads.py. */
export const UPLOAD_LIMITS_MB = { avatar: 2, speaker: 2, cover: 5 } as const;

/** The person who built ConferenceHub, shown on the About page and in the footer. */
export const CREATOR = {
  name: 'Induwara Ihalavithana',
  photo: '/creator.webp',
  github: 'https://github.com/InduwaraIhalavithana',
};
