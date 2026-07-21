export const DEMO_MEDIA_CATALOG = Object.freeze([
  Object.freeze({
    id: "terrain-study-1",
    label: "Terrain Study I",
    url: "./media/terrain-study-1.mp4",
    origin: "author-recorded",
  }),
  Object.freeze({
    id: "terrain-study-2",
    label: "Terrain Study II",
    url: "./media/terrain-study-2.mp4",
    origin: "author-recorded",
  }),
  Object.freeze({
    id: "terrain-study-3",
    label: "Terrain Study III",
    url: "./media/terrain-study-3.mp4",
    origin: "author-recorded",
  }),
  Object.freeze({
    id: "abstract-color-field",
    label: "Abstract Color Field",
    url: "./media/projector-space-demo.mp4",
    origin: "procedural",
  }),
]);

export const DEFAULT_DEMO_MEDIA_ID = "terrain-study-1";

export const getDemoMediaOption = (mediaId) =>
  DEMO_MEDIA_CATALOG.find(({ id }) => id === mediaId) || null;
