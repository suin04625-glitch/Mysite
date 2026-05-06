const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_ORIGIN = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '';
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DIST_DIR = path.join(__dirname, 'dist');
const DIST_INDEX_FILE = path.join(DIST_DIR, 'index.html');
const MAX_BODY_SIZE = 50 * 1024 * 1024;
const ALLOWED_PAGES = new Set(['home', 'characters', 'detail', 'logs', 'admin', 'my-intro', 'world-intro']);
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHexColor = (value) => {
  if (typeof value !== 'string') return null;

  let color = value.trim();
  if (!color) return null;
  if (!color.startsWith('#')) {
    color = `#${color}`;
  }

  if (!HEX_COLOR_REGEX.test(color)) return null;

  if (color.length === 4) {
    color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return color.toUpperCase();
};

const DEFAULT_STATE = {
  page: 'home',
  isAdmin: false,
  selectedCharId: null,
  characters: [
    {
      id: 1,
      name: '실반 (Silvan)',
      community: '딜러',
      age: '24세',
      birth: '05월 09일',
      spec: '178cm / 68kg',
      gender: '남성',
      oneLine: '햇빛 좋은 날엔 그냥 지나칠 수 없지!',
      image: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=1000&auto=format&fit=crop',
      personality: '밝고 쾌활하며 예술을 사랑합니다. 타인에게 친절하지만 내면에는 고독함을 간직하고 있습니다.',
      notices: '초록빛 머리카락이 인상적이며, 항상 작은 꽃을 품고 다닙니다.',
      stats: '근력 3, 민첩 5, 지력 4',
      skills: '자연의 숨결: 주변 식물을 성장시키는 능력',
      imageBackdropColor: '#9BE47B',
      logs: []
    }
  ],
  worldStages: [
    {
      id: 'moonlight-square',
      name: '문라이트 광장',
      type: '메인 허브',
      oneLine: '모든 관계선이 처음 교차하는 장소',
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop',
      color: '#9CD7FF',
      overview: '자관의 시작 이벤트가 열리는 중심 무대입니다. 일상적인 대화 장면부터 주요 충돌의 도화선까지 대부분 이곳에서 출발합니다.',
      faction: '광장 관리단, 야간 순찰반, 비공식 정보상 네트워크가 동시에 활동합니다. 평화로운 외형과 달리 세력 간 미묘한 긴장이 유지됩니다.',
      incident: '축제의 밤 정전 사건, 추격전 개시, 신규 인물 첫 등장 같은 장면이 자주 배치됩니다.',
      guide: [
        '첫 만남 RP를 시작하기 가장 안정적인 무대입니다.',
        '관계 트리거가 필요하면 광장 이벤트 공지를 활용합니다.',
        '공개 장면 로그를 먼저 남기면 이후 사건 연결이 쉬워집니다.'
      ]
    },
    {
      id: 'archive-13f',
      name: '기록보관소 13층',
      type: '아카이브 구역',
      oneLine: '숨겨진 진실이 문서 형태로 잠드는 층',
      image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=1200&auto=format&fit=crop',
      color: '#B7C9FF',
      overview: '사건 기록, 관계 변동 보고서, 개인 로그가 축적되는 데이터 중심 공간입니다. 정적인 무대지만 이야기의 무게감이 크게 형성됩니다.',
      faction: '기록감독국, 열람 심의위원, 내부 제보자가 얽혀 정보 접근 권한을 통제합니다.',
      incident: '봉인 문서 유출, 과거 사건 재해석, 잃어버린 기록 복원 장면이 자주 발생합니다.',
      guide: [
        '설정 회수나 떡밥 공개 장면에 가장 어울립니다.',
        '캐릭터의 과거사를 공식화할 때 로그 링크를 함께 남기세요.',
        '기록 충돌이 생기면 최신 타임라인 기준으로 정리합니다.'
      ]
    },
    {
      id: 'sunset-station',
      name: '노을역 지하 통로',
      type: '서브 스테이지',
      oneLine: '거래와 추적, 배신이 교차하는 어두운 통로',
      image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1200&auto=format&fit=crop',
      color: '#FFC7A3',
      overview: '공식 조직의 시선이 닿지 않는 회색지대입니다. 빠른 템포의 긴장 장면이나 감정 폭발 파트를 배치하기 좋습니다.',
      faction: '운송 브로커, 암시장 연락책, 독립 해결사가 불안정한 균형을 이루고 있습니다.',
      incident: '비밀 계약 체결, 추적전 역전, 위장 신분 붕괴 장면이 집중적으로 발생합니다.',
      guide: [
        '위험도를 올리고 싶을 때 서브 미션 무대로 사용하세요.',
        '세력 충돌 RP는 참여 인원과 목적을 먼저 합의하면 좋습니다.',
        '씬 종료 후 후속 로그를 짧게라도 남겨 흐름을 고정하세요.'
      ]
    }
  ]
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const resolvePublicUrl = (pathname) => {
  if (PUBLIC_ORIGIN) {
    return new URL(pathname, PUBLIC_ORIGIN).toString();
  }

  return pathname;
};

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
};

const serveFile = (res, filePath) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Access-Control-Allow-Origin': '*'
  });

  fs.createReadStream(filePath).pipe(res);
  return true;
};

const serveFrontend = (req, res) => {
  if (req.method !== 'GET') return false;

  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (requestPath.startsWith('/api/')) return false;

  const targetPath = requestPath === '/' ? DIST_INDEX_FILE : path.resolve(DIST_DIR, `.${requestPath}`);
  const isInsideDist = path.relative(DIST_DIR, targetPath).split(path.sep)[0] !== '..';

  if (isInsideDist && serveFile(res, targetPath)) {
    return true;
  }

  return serveFile(res, DIST_INDEX_FILE);
};

const ensureStorage = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
};

const cloneDefaultState = () => ({
  ...DEFAULT_STATE,
  characters: DEFAULT_STATE.characters.map((char) => ({
    ...char,
    logs: [...(char.logs || [])]
  })),
  worldStages: DEFAULT_STATE.worldStages.map((stage) => ({
    ...stage,
    guide: [...(stage.guide || [])]
  }))
});

const normalizeWorldStages = (rawWorldStages) => {
  if (!Array.isArray(rawWorldStages)) return null;

  return rawWorldStages
    .filter((stage) => stage && typeof stage === 'object')
    .map((stage, index) => {
      const normalizedGuide = Array.isArray(stage.guide)
        ? stage.guide
            .filter((guideLine) => typeof guideLine === 'string' && guideLine.trim().length > 0)
            .map((guideLine) => guideLine.trim())
        : [];

      return {
        id: stage.id ?? `${Date.now()}-stage-${index}`,
        name: typeof stage.name === 'string' && stage.name.trim() ? stage.name.trim() : `무대 ${index + 1}`,
        type: typeof stage.type === 'string' ? stage.type.trim() : '',
        oneLine: typeof stage.oneLine === 'string' ? stage.oneLine.trim() : '',
        image: typeof stage.image === 'string' ? stage.image.trim() : '',
        color: normalizeHexColor(stage.color) || '#9CD7FF',
        overview: typeof stage.overview === 'string' ? stage.overview.trim() : '',
        faction: typeof stage.faction === 'string' ? stage.faction.trim() : '',
        incident: typeof stage.incident === 'string' ? stage.incident.trim() : '',
        guide: normalizedGuide
      };
    });
};

const normalizeState = (rawState) => {
  if (!rawState || typeof rawState !== 'object' || !Array.isArray(rawState.characters)) {
    return null;
  }

  const normalizedCharacters = rawState.characters
    .filter((char) => char && typeof char === 'object')
    .map((char, index) => {
      const normalizedLogs = Array.isArray(char.logs)
        ? char.logs
            .filter((log) => log && typeof log === 'object' && typeof log.url === 'string' && log.url.length > 0)
            .map((log, logIndex) => ({
              ...log,
              id: log.id ?? `${Date.now()}-log-${index}-${logIndex}`
            }))
        : [];

      return {
        ...char,
        id: char.id ?? `${Date.now()}-char-${index}`,
        imageBackdropColor: normalizeHexColor(char.imageBackdropColor),
        logs: normalizedLogs
      };
    });

  const selectedCharId = rawState.selectedCharId ?? null;
  const hasSelectedChar =
    selectedCharId == null || normalizedCharacters.some((char) => char.id === selectedCharId);

  const hasWorldStagesField = Object.prototype.hasOwnProperty.call(rawState, 'worldStages');
  const normalizedWorldStages = hasWorldStagesField
    ? normalizeWorldStages(rawState.worldStages)
    : cloneDefaultState().worldStages;
  if (!normalizedWorldStages) {
    return null;
  }

  return {
    page: ALLOWED_PAGES.has(rawState.page) ? rawState.page : 'home',
    isAdmin: Boolean(rawState.isAdmin),
    selectedCharId: hasSelectedChar ? selectedCharId : null,
    characters: normalizedCharacters,
    worldStages: normalizedWorldStages
  };
};

const readState = () => {
  ensureStorage();

  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);

    if (!normalized) {
      const fallback = cloneDefaultState();
      fs.writeFileSync(STATE_FILE, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }

    return normalized;
  } catch (error) {
    const fallback = cloneDefaultState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
};

const writeState = (state) => {
  ensureStorage();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
};

const parseJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    let hasRejected = false;

    req.on('data', (chunk) => {
      if (hasRejected) return;

      totalLength += chunk.length;
      if (totalLength > MAX_BODY_SIZE) {
        hasRejected = true;
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (hasRejected) return;

      if (chunks.length === 0) {
        resolve({});
        return;
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', (error) => {
      if (!hasRejected) {
        reject(error);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (serveFrontend(req, res)) {
    return;
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      message: 'Backend is running',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.url === '/api/info' && req.method === 'GET') {
    sendJson(res, 200, {
      app: 'Character Archive Backend',
      version: '1.1.0',
      storage: STATE_FILE,
      uploads: UPLOADS_DIR
    });
    return;
  }

  if (req.url.startsWith('/uploads/') && req.method === 'GET') {
    try {
      const filename = path.basename(req.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        serveFile(res, filePath);
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (req.url === '/api/upload' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (!body.image || !body.filename) {
        sendJson(res, 400, { status: 'error', message: 'Missing image or filename' });
        return;
      }

      const matches = body.image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        sendJson(res, 400, { status: 'error', message: 'Invalid base64 image data' });
        return;
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const outputFilename = `${timestamp}-${randomStr}.webp`;
      const outputPath = path.join(UPLOADS_DIR, outputFilename);

      const sharp = require('sharp');
      await sharp(buffer)
        .webp({ quality: 80 })
        .toFile(outputPath);

      sendJson(res, 200, {
        status: 'ok',
        url: resolvePublicUrl(`/uploads/${outputFilename}`)
      });
      return;
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { status: 'error', message: 'Upload failed' });
      return;
    }
  }

  if (req.url === '/api/state' && req.method === 'GET') {
    sendJson(res, 200, readState());
    return;
  }

  if (req.url === '/api/state' && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const body = await parseJsonBody(req);
      const normalized = normalizeState(body);

      if (!normalized) {
        sendJson(res, 400, {
          status: 'error',
          message: 'Invalid state payload'
        });
        return;
      }

      writeState(normalized);
      sendJson(res, 200, {
        status: 'ok',
        savedAt: new Date().toISOString()
      });
      return;
    } catch (error) {
      const isBodyTooLarge = error.message === 'PAYLOAD_TOO_LARGE';
      const isInvalidJson = error.message === 'INVALID_JSON';

      sendJson(res, isBodyTooLarge ? 413 : 400, {
        status: 'error',
        message: isBodyTooLarge
          ? 'Payload is too large'
          : isInvalidJson
            ? 'Invalid JSON payload'
            : 'Request failed'
      });
      return;
    }
  }

  sendJson(res, 404, {
    status: 'error',
    message: 'Not Found'
  });
});

server.listen(PORT, () => {
  ensureStorage();
  console.log(`Backend server running on http://${HOST}:${PORT}`);
});
