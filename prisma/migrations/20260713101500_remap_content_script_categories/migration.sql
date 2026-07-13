UPDATE "ContentPlanner"
SET "category" = CASE
  WHEN "category" = 'Instagram Feed' THEN 'Product'
  WHEN "category" = 'Instagram Reel' THEN 'Product'
  WHEN "category" = 'TikTok' THEN 'Product'
  WHEN "category" = 'YouTube Shorts' THEN 'Education'
  WHEN "category" = 'YouTube' THEN 'Education'
  WHEN "category" = 'Campaign' THEN 'Community'
  WHEN "category" = 'Article' THEN 'Education'
  WHEN "category" = 'Other' THEN 'Story'
  WHEN "category" = 'Promotion' THEN 'Product'
  WHEN "category" = 'Branding' THEN 'Story'
  WHEN "category" = 'Event' THEN 'Community'
  WHEN "category" = 'Announcement' THEN 'Community'
  ELSE "category"
END;

UPDATE "ContentPlanner"
SET "category" = 'Story'
WHERE COALESCE("category", '') = ''
   OR "category" NOT IN ('Story', 'Education', 'Proofen', 'Product', 'Community');
