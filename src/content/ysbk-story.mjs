import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveProjectRoot() {
  const cwdCandidate = path.resolve(process.cwd(), 'content/ysbk-story.json');
  if (fs.existsSync(cwdCandidate)) return process.cwd();
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir && path.dirname(dir) !== dir) {
    if (fs.existsSync(path.join(dir, 'content/ysbk-story.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const projectRoot = resolveProjectRoot();
const defaultStoryPath = path.join(projectRoot, 'content/ysbk-story.json');
const defaultAssetRoot = path.join(projectRoot, 'public/book/assets');

export function validateStory(input, { assetRoot = defaultAssetRoot } = {}) {
  const fail = (field, message) => { throw new Error(`${field}: ${message}`); };
  const object = (value, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'expected an object');
    return value;
  };
  const text = (value, field, empty = false) => {
    if (typeof value !== 'string' || (!empty && !value.trim())) fail(field, 'expected text');
    return value;
  };
  const array = (value, field, min, max) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail(field, `expected ${min}–${max} items`);
    return value;
  };
  const asset = (value, field, audio = false) => {
    text(value, field);
    const extension = audio ? /\.(mp3|ogg|wav)$/i : /\.(png|jpe?g|webp|avif|svg)$/i;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || value.includes('..') || !extension.test(value)) {
      fail(field, 'use a plain asset filename with a supported extension');
    }
    const absolute = path.resolve(assetRoot, value);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      fail(field, `file not found: ${value}`);
    }
    const realRoot = fs.realpathSync(assetRoot);
    const realFile = fs.realpathSync(absolute);
    const relative = path.relative(realRoot, realFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      fail(field, 'asset escapes its directory');
    }
    return value;
  };
  const link = (value, field) => {
    object(value, field);
    const href = text(value.href, field + '.href');
    if (/[\s\\\x00-\x1f\x7f]/.test(href)) fail(field + '.href', 'invalid URL');
    let url;
    try { url = new URL(href, 'https://template.invalid/'); } catch { fail(field + '.href', 'invalid URL'); }
    const local = /^(?:\/(?!\/)|#|\.\.?\/)/.test(href) && url.origin === 'https://template.invalid';
    if (!local && !(url.protocol === 'https:' && href.startsWith('https://')) && !(url.protocol === 'mailto:' && href.startsWith('mailto:') && url.pathname)) {
      fail(field + '.href', 'use https:, mailto: or a local path/fragment');
    }
    if (url.username || url.password) fail(field + '.href', 'credentials are not allowed in links');
    if (/^\/(?:sach|login|noi-bo|cong-dong)(?:\/|[?#]|$)/.test(url.pathname) && local) {
      fail(field + '.href', 'the library web-app is not part of this landing page');
    }
    return { label: text(value.label, field + '.label'), href };
  };
  const photo = (value, field) => {
    object(value, field);
    const position = value.position ?? '50% 50%';
    if (!/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(position) || position.split(' ').some(part => parseFloat(part) > 100)) {
      fail(field + '.position', 'use two percentages from 0% to 100%');
    }
    const zoom = value.zoom ?? 1;
    if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom < 1 || zoom > 2) {
      fail(field + '.zoom', 'expected a number from 1 to 2');
    }
    return {
      file: asset(value.file, field + '.file'),
      caption: text(value.caption ?? '', field + '.caption', true),
      position,
      zoom,
      source: typeof value.source === 'string' ? value.source : undefined
    };
  };

  object(input, 'story');
  if (input.schemaVersion !== 1) fail('schemaVersion', 'expected 1');
  const locale = text(input.locale, 'locale');
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) fail('locale', 'invalid locale');

  object(input.brand, 'brand');
  text(input.brand.name, 'brand.name');
  text(input.brand.tagline, 'brand.tagline');

  object(input.cover, 'cover');
  asset(input.cover.image, 'cover.image');
  photo(input.cover.logo, 'cover.logo');
  if (input.cover.footerLogo) photo(input.cover.footerLogo, 'cover.footerLogo');

  object(input.background, 'background');
  asset(input.background.image, 'background.image');

  link(input.cta, 'cta');
  if (input.secondaryCta) link(input.secondaryCta, 'secondaryCta');

  object(input.labels, 'labels');

  const ids = new Set();
  const chapters = array(input.chapters, 'chapters', 1, 20).map((value, i) => {
    const field = `chapters[${i}]`;
    object(value, field);
    const id = text(value.id, field + '.id');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) fail(field + '.id', 'expected a unique lowercase slug');
    ids.add(id);

    const kind = text(value.kind, field + '.kind');
    if (!['story', 'people', 'gallery', 'slogan'].includes(kind)) fail(field + '.kind', 'unsupported layout kind');

    const chapter = {
      id,
      kind,
      name: text(value.name, field + '.name')
    };

    if (kind === 'story') {
      chapter.title = text(value.title, field + '.title');
      chapter.kicker = text(value.kicker, field + '.kicker');
      chapter.photos = array(value.photos, field + '.photos', 1, 4).map((p, j) => photo(p, `${field}.photos[${j}]`));
      chapter.lines = array(value.lines, field + '.lines', 1, 10).map((l, j) => text(l, `${field}.lines[${j}]`));
      if (value.compactLines) {
        chapter.compactLines = array(value.compactLines, field + '.compactLines', 1, 10).map((l, j) => text(l, `${field}.compactLines[${j}]`));
      }
    } else if (kind === 'people') {
      chapter.kicker = text(value.kicker, field + '.kicker');
      chapter.photos = array(value.photos, field + '.photos', 2, 6).map((p, j) => photo(p, `${field}.photos[${j}]`));
      chapter.lines = array(value.lines, field + '.lines', 1, 4).map((l, j) => text(l, `${field}.lines[${j}]`));
    } else if (kind === 'gallery') {
      const items = value.items || input.activities;
      chapter.items = array(items, field + '.items', 2, 12).map((item, j) => {
        object(item, `${field}.items[${j}]`);
        return {
          title: text(item.title, `${field}.items[${j}].title`),
          photo: photo(item.photo, `${field}.items[${j}].photo`)
        };
      });
    } else if (kind === 'slogan') {
      chapter.illustrations = array(value.illustrations, field + '.illustrations', 2, 2).map((ill, j) => {
        object(ill, `${field}.illustrations[${j}]`);
        return {
          file: asset(ill.file, `${field}.illustrations[${j}].file`),
          alt: text(ill.alt, `${field}.illustrations[${j}].alt`)
        };
      });
    }

    if (value.sources) {
      chapter.sources = array(value.sources, field + '.sources', 0, 5).map((s, j) => text(s, `${field}.sources[${j}]`));
    }

    return chapter;
  });

  return {
    ...input,
    chapters
  };
}

export function loadStory(filePath = defaultStoryPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  return validateStory(data, { assetRoot: defaultAssetRoot });
}

export function syncPublicBookContent(outPath = fileURLToPath(new URL('../../public/book/book-content.mjs', import.meta.url))) {
  const story = loadStory();
  const banner = '// Auto-generated from content/ysbk-story.json. Do not edit directly.\n';
  const content = `${banner}export const site = ${JSON.stringify(story, null, 2)};\nexport const chapters = site.chapters;\nexport const activities = site.activities;\nexport const galleryActivities = activities;\n`;
  fs.writeFileSync(outPath, content, 'utf8');
}

