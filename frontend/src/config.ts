/**
 * Public contact address for the About, Contact and Help pages and the footer. It is not stored in the
 * repository: set VITE_CONTACT_EMAIL in frontend/.env (or as a build argument) to show it. Left empty,
 * the pages simply leave the address out and point people to the contact form.
 */
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL ?? '';

/** Upload limits, kept in step with backend/app/core/uploads.py. */
export const UPLOAD_LIMITS_MB = { avatar: 2, speaker: 2, cover: 5 } as const;

/** The person who built ConferenceHub, shown on the About page and in the footer. */
export const CREATOR = {
  name: 'Induwara Ihalavithana',
  photo: '/creator.webp',
  github: 'https://github.com/InduwaraIhalavithana',
};
