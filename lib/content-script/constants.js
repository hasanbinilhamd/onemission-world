export const CONTENT_SCRIPT_CATEGORY_OPTIONS = [
  'Story',
  'Education',
  'Proofen',
  'Product',
  'Community',
];

export const CONTENT_SCRIPT_LEGACY_CATEGORY_MAP = {
  Story: 'Story',
  Education: 'Education',
  Proofen: 'Proofen',
  Product: 'Product',
  Community: 'Community',
  'Instagram Feed': 'Product',
  'Instagram Reel': 'Product',
  TikTok: 'Product',
  'YouTube Shorts': 'Education',
  YouTube: 'Education',
  Campaign: 'Community',
  Article: 'Education',
  Other: 'Story',
  Promotion: 'Product',
  Branding: 'Story',
  Event: 'Community',
  Announcement: 'Community',
};

export const CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const CONTENT_SCRIPT_ALLOWED_MIME_TYPES = ['application/pdf'];
