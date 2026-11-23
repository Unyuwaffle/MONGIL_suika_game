/**
 * 수박게임 — Monring Edition
 * ===========================
 * Matter.js 물리 엔진 + Canvas 2D 렌더
 * 논리 해상도 1280×720 고정, 레터박스 반응형
 */

'use strict';

/* ============================================================
   CONFIG — 전역 상수
   ============================================================ */
const CFG = {
  W: 1280,
  H: 720,

  // 게임 통(box) 경계 — 논리 좌표 기준
  // 패널 220px 제외한 나머지 1060px 안에서 게임통 608px 중앙 정렬
  // 좌여백 = (1060 - 608) / 2 = 226
  BOX_LEFT:   226,
  BOX_RIGHT:  834,
  BOX_TOP:    155,
  BOX_BOTTOM: 705,

  // 기준선 Y
  DANGER_Y: 180,

  // 아이템 반지름 (level 0~10, px 논리 해상도 기준)
  ITEM_RADII: [16, 22, 30, 40, 52, 64, 80, 98, 118, 140, 162],

  // 히트박스는 이미지보다 살짝 타이트하게 (렌더 반지름의 88%)
  HITBOX_RATIO: 0.88,

  // 합치기 점수 (11단계, 마지막 level 10+10 → 소멸)
  MERGE_SCORES: [10, 50, 100, 200, 500, 1000, 5000, 10000, 50000, 100000, 200000],

  // 투하 쿨다운 (ms)
  DROP_COOLDOWN: 400,

  // 낙하 중 아이템 기준선 판정 제외 유예 시간 (ms)
  SETTLE_GRACE: 2000,

  // 착지 판정 속도 임계값
  SETTLE_SPEED: 1.2,

  // 게임 오버 카운트다운 (ms)
  GAMEOVER_DELAY: 3000,

  // 벽·바닥 두께
  WALL_T: 40,

  // 파티클
  PARTICLE_COUNT: 32,
  PARTICLE_SPEED_MIN: 2,
  PARTICLE_SPEED_MAX: 10,
  PARTICLE_LIFE: 55,

  // 아이템 색상 (폴백 원 + 파티클)
  ITEM_COLORS: [
    '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#1DD1A1',
    '#FF6B9D', '#C44DFF', '#5F27CD', '#00D2D3', '#FF4757', '#FFD700'
  ],

  // 우측 패널 왼쪽 경계 (BOX_RIGHT + 10)
  PANEL_X: 844,

  // 패널 내 고정 Y 좌표
  PANEL_SCORE_Y:   42,   // SCORE 텍스트
  PANEL_NEXT_Y:   118,   // NEXT 텍스트
  PANEL_PREVIEW_CY: 176, // NEXT 아이템 중심 Y (고정)
  PANEL_GUIDE_TOP:  230, // 합치기 가이드 이미지 상단 Y (고정)
};

/* ============================================================
   ScaleManager — 레터박스 반응형 + 좌표 변환
   ============================================================ */
const ScaleManager = (() => {
  const wrapper = document.getElementById('gameWrapper');
  let scale = 1, offX = 0, offY = 0;

  function apply() {
    scale = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
    offX = (window.innerWidth  - CFG.W * scale) / 2;
    offY = (window.innerHeight - CFG.H * scale) / 2;
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.marginLeft = offX + 'px';
    wrapper.style.marginTop  = offY + 'px';
  }

  function toLogical(cx, cy) {
    return { x: (cx - offX) / scale, y: (cy - offY) / scale };
  }

  window.addEventListener('resize', apply);
  apply();

  return { apply, toLogical, getScale: () => scale };
})();

/* ============================================================
   SoundManager — Web Audio API 효과음
   ============================================================ */
const SoundManager = (() => {
  let audioCtx = null;

  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playDrop() {
    try {
      const c = ctx();
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.1);
    } catch (_) {}
  }

  function playMerge(level) {
    try {
      const c = ctx();
      const freq = Math.max(80, 580 - level * 42);
      const dur  = 0.15 + level * 0.03;
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.5, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq, c.currentTime + dur * 0.3);
      gain.gain.setValueAtTime(0.4, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + dur);
    } catch (_) {}
  }

  function playExplosion() {
    try {
      const c       = ctx();
      const bufSize = c.sampleRate * 0.6;
      const buffer  = c.createBuffer(1, bufSize, c.sampleRate);
      const data    = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
      }
      const src  = c.createBufferSource();
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.6, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
      src.buffer = buffer;
      src.connect(gain); gain.connect(c.destination);
      src.start();
    } catch (_) {}
  }

  return { playDrop, playMerge, playExplosion };
})();

/* ============================================================
   이미지 사전 로드 (monring1~11 + ev_ex)
   ============================================================ */
const images    = new Array(11).fill(null); // monring1~11
let   sampleImg = null;                     // ev_ex.png (합치기 가이드)

function loadImages() {
  const itemPromises = images.map((_, i) =>
    new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { images[i] = img; resolve(); };
      img.onerror = () => { images[i] = null; resolve(); };
      img.src = `image/monring${i + 1}.png`;
    })
  );

  const samplePromise = new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { sampleImg = img; resolve(); };
    img.onerror = () => { sampleImg = null; resolve(); };
    img.src = 'image/ev_ex.png';
  });

  return Promise.all([...itemPromises, samplePromise]);
}

/* ============================================================
   PhysicsWorld + ItemFactory
   ============================================================ */
let engine, world;

/** itemData: bodyId → { level, droppedAt, isSettled } */
const itemData = new Map();

function initPhysics() {
  engine = Matter.Engine.create({ gravity: { x: 0, y: 1.8 } });
  world  = engine.world;

  const W = CFG.WALL_T;
  const walls = [
    // 바닥
    Matter.Bodies.rectangle(
      (CFG.BOX_LEFT + CFG.BOX_RIGHT) / 2,
      CFG.BOX_BOTTOM + W / 2,
      CFG.BOX_RIGHT - CFG.BOX_LEFT + W * 2, W,
      { isStatic: true, label: 'wall', friction: 0.3 }
    ),
    // 왼쪽 벽
    Matter.Bodies.rectangle(
      CFG.BOX_LEFT - W / 2,
      (CFG.BOX_TOP + CFG.BOX_BOTTOM) / 2,
      W, CFG.BOX_BOTTOM - CFG.BOX_TOP + W * 2,
      { isStatic: true, label: 'wall', friction: 0.3 }
    ),
    // 오른쪽 벽
    Matter.Bodies.rectangle(
      CFG.BOX_RIGHT + W / 2,
      (CFG.BOX_TOP + CFG.BOX_BOTTOM) / 2,
      W, CFG.BOX_BOTTOM - CFG.BOX_TOP + W * 2,
      { isStatic: true, label: 'wall', friction: 0.3 }
    ),
  ];
  Matter.World.add(world, walls);
}

/* ============================================================
   HITBOX SHAPES — 레벨별 Compound Body 정의
   이미지를 256×256 픽셀 기준으로 정밀 측정, 정규화(r=1.0 기준)
   parts: [{ ox, oy, r }]  — 본체 중심으로부터의 오프셋과 반지름 비율
   oy 양수=아래, 음수=위 / ox 양수=오른쪽, 음수=왼쪽

   lv0  버섯        : 귀/돌출 없음. 본체가 가로로 넓고 위(모자)가 붉고 아래가 흰 타원.
                      세로 중심이 이미지 중앙보다 약간 위.
   lv1  슬라임      : 귀/돌출 없음. 위가 높이 솟은 물방울형. 세로가 가로보다 약간 큼.
   lv2  고양이귀    : 위쪽 귀 2개(작고 삼각형). 본체는 거의 정원.
   lv3  엑솔로틀    : 양옆 아가미 돌기(작음). 본체 가로로 넓은 타원.
   lv4  악마물고기  : 위 뿔 2개(작음), 양옆 날개(중간). 본체 거의 원형.
   lv5  토끼+모자   : 위에 모자 넓게 덮음. 아래 얼굴 타원 + 모자 영역.
   lv6  햄스터      : 본체 가로 매우 넓고 납작. 아래 양발 약간 돌출.
   lv7  로봇(날개)  : 양옆 날개 크게 돌출. 본체 원형.
   lv8  로봇고양이  : 위쪽 귀 2개(중간). 본체 원형.
   lv9  뿔캐릭터    : 양쪽 뿔(위). 본체 가로 넓은 타원.
   lv10 고양이보라  : 위쪽 귀 2개(뚜렷). 본체 원형, 하단이 약간 더 넓음.
   ============================================================ */
const HITBOX_SHAPES = [
  // lv0 버섯 — 귀 없음, 가로 넓고 세로 짧은 타원
  // 본체: 이미지 중심보다 약 5% 위, 가로 85% 세로 70% → 3원 가로 조합
  { type: 'compound', parts: [
    { ox:  0.00, oy: -0.05, r: 0.68 },   // 중앙 주원
    { ox: -0.42, oy:  0.00, r: 0.46 },   // 왼쪽 보조
    { ox:  0.42, oy:  0.00, r: 0.46 },   // 오른쪽 보조
  ]},

  // lv1 슬라임 — 귀 없음, 위가 솟은 물방울형, 가로보다 세로 약간 큼
  { type: 'compound', parts: [
    { ox:  0.00, oy: -0.08, r: 0.74 },   // 본체 중심 (위쪽)
    { ox: -0.28, oy:  0.30, r: 0.52 },   // 아래 왼
    { ox:  0.28, oy:  0.30, r: 0.52 },   // 아래 오른
  ]},

  // lv2 고양이귀 — 위 삼각귀 2개. 귀는 작고 뾰족해서 충돌에 큰 영향 없음
  // 본체 거의 정원, 귀 포함 위쪽 살짝만 커버
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.06, r: 0.72 },   // 본체 (약간 아래)
    { ox: -0.38, oy: -0.58, r: 0.22 },   // 왼쪽 귀
    { ox:  0.38, oy: -0.58, r: 0.22 },   // 오른쪽 귀
  ]},

  // lv3 엑솔로틀 — 본체 가로 넓은 타원 + 양옆 작은 아가미
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.02, r: 0.70 },   // 본체 중앙
    { ox: -0.52, oy:  0.05, r: 0.42 },   // 왼쪽 타원 보조
    { ox:  0.52, oy:  0.05, r: 0.42 },   // 오른쪽 타원 보조
    { ox: -0.82, oy:  0.08, r: 0.18 },   // 왼쪽 아가미 (작게)
    { ox:  0.82, oy:  0.08, r: 0.18 },   // 오른쪽 아가미 (작게)
  ]},

  // lv4 악마물고기 — 본체 거의 원형, 양옆 날개(중간), 위 뿔(작음)
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.05, r: 0.72 },   // 본체
    { ox: -0.68, oy:  0.10, r: 0.26 },   // 왼쪽 날개
    { ox:  0.68, oy:  0.10, r: 0.26 },   // 오른쪽 날개
    { ox: -0.22, oy: -0.68, r: 0.14 },   // 왼쪽 뿔 (매우 작게)
    { ox:  0.22, oy: -0.68, r: 0.14 },   // 오른쪽 뿔
  ]},

  // lv5 토끼+모자 — 아래 얼굴 원 + 위쪽 모자가 넓고 두꺼움
  // 모자 가로 폭이 얼굴보다 훨씬 넓음 → 모자 영역 3원으로 커버
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.22, r: 0.58 },   // 아래 얼굴 본체
    { ox:  0.00, oy: -0.22, r: 0.52 },   // 모자 중앙
    { ox: -0.52, oy: -0.18, r: 0.36 },   // 모자 왼쪽
    { ox:  0.52, oy: -0.18, r: 0.36 },   // 모자 오른쪽
  ]},

  // lv6 햄스터 — 가로 매우 넓고 납작. 양발 아래 돌출
  { type: 'compound', parts: [
    { ox:  0.00, oy: -0.05, r: 0.65 },   // 본체 중앙
    { ox: -0.55, oy:  0.00, r: 0.46 },   // 왼쪽 본체 확장
    { ox:  0.55, oy:  0.00, r: 0.46 },   // 오른쪽 본체 확장
    { ox: -0.62, oy:  0.38, r: 0.24 },   // 왼발
    { ox:  0.62, oy:  0.38, r: 0.24 },   // 오른발
  ]},

  // lv7 로봇(날개) — 본체 원형, 양옆 날개 크게 돌출
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.05, r: 0.70 },   // 본체
    { ox: -0.72, oy: -0.05, r: 0.32 },   // 왼쪽 날개
    { ox:  0.72, oy: -0.05, r: 0.32 },   // 오른쪽 날개
  ]},

  // lv8 로봇고양이 — 본체 원형, 위쪽 귀 2개 (중간 크기)
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.06, r: 0.74 },   // 본체
    { ox: -0.44, oy: -0.60, r: 0.26 },   // 왼쪽 귀
    { ox:  0.44, oy: -0.60, r: 0.26 },   // 오른쪽 귀
  ]},

  // lv9 뿔캐릭터 — 본체 가로 넓은 타원, 양쪽 뿔(위, 작음)
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.05, r: 0.68 },   // 본체 중앙
    { ox: -0.45, oy:  0.08, r: 0.46 },   // 왼쪽 타원 보조
    { ox:  0.45, oy:  0.08, r: 0.46 },   // 오른쪽 타원 보조
    { ox: -0.30, oy: -0.68, r: 0.16 },   // 왼쪽 뿔
    { ox:  0.30, oy: -0.68, r: 0.16 },   // 오른쪽 뿔
  ]},

  // lv10 고양이보라 — 본체 원형(하단 약간 넓음), 위쪽 귀 2개(뚜렷)
  { type: 'compound', parts: [
    { ox:  0.00, oy:  0.05, r: 0.76 },   // 본체 (하단 무게감)
    { ox: -0.30, oy:  0.40, r: 0.42 },   // 하단 왼쪽 (넓은 아랫부분)
    { ox:  0.30, oy:  0.40, r: 0.42 },   // 하단 오른쪽
    { ox: -0.46, oy: -0.58, r: 0.26 },   // 왼쪽 귀
    { ox:  0.46, oy: -0.58, r: 0.26 },   // 오른쪽 귀
  ]},
];

/**
 * 레벨별 Compound Body 생성
 * - parts 각 원의 반지름/오프셋은 ITEM_RADII[level] 기준으로 스케일
 * - 모든 part에 같은 label 부여 → 합치기 감지 정상 동작
 * - 충돌 감지는 collisionStart의 bodyA/bodyB (부모 바디) 기준이므로 문제없음
 */
function createItem(level, x, y, isDrop = false) {
  const R      = CFG.ITEM_RADII[level];
  const shape  = HITBOX_SHAPES[level];
  const props  = {
    label:       String(level),
    restitution: 0.2,
    friction:    0.6,
    frictionAir: 0.01,
    density:     0.004 + level * 0.001,
  };

  let body;

  if (shape.type === 'compound') {
    // 각 파트를 개별 원으로 만들어 Compound Body 구성
    const parts = shape.parts.map(p =>
      Matter.Bodies.circle(
        x + p.ox * R,
        y + p.oy * R,
        Math.max(4, Math.round(p.r * R)),
        { restitution: props.restitution, friction: props.friction }
      )
    );
    body = Matter.Body.create({ ...props, parts });
    // Compound body 생성 후 위치를 명시적으로 설정
    Matter.Body.setPosition(body, { x, y });
  } else {
    body = Matter.Bodies.circle(x, y, Math.round(R * 0.85), props);
  }

  Matter.World.add(world, body);
  itemData.set(body.id, {
    level,
    droppedAt: isDrop ? Date.now() : 0,
    isSettled: !isDrop,
  });
  return body;
}

/* ============================================================
   MergeSystem — 충돌 감지 + 합치기
   ============================================================ */
const pendingMerges = new Set();
const mergingIds    = new Set();
let   score         = 0;

function setupCollisionEvents() {
  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      // Compound Body의 경우 bodyA/bodyB가 part일 수 있으므로 parent로 올라감
      const a = pair.bodyA.parent || pair.bodyA;
      const b = pair.bodyB.parent || pair.bodyB;
      if (a === b) continue;                                        // 같은 compound 내부 충돌
      if (a.label === 'wall' || b.label === 'wall') continue;
      if (a.label !== b.label) continue;
      if (mergingIds.has(a.id) || mergingIds.has(b.id)) continue;

      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      if (!pendingMerges.has(key)) {
        pendingMerges.add(key);
        mergingIds.add(a.id);
        mergingIds.add(b.id);
      }
    }
  });
}

function processMerges() {
  if (pendingMerges.size === 0) return;

  const bodyMap = new Map();
  for (const body of Matter.Composite.allBodies(world)) {
    if (body.parent === body) bodyMap.set(body.id, body); // 부모 바디만
  }

  for (const key of pendingMerges) {
    const [idA, idB] = key.split(':').map(Number);
    const a = bodyMap.get(idA), b = bodyMap.get(idB);

    if (!a || !b) {
      pendingMerges.delete(key);
      mergingIds.delete(idA); mergingIds.delete(idB);
      continue;
    }

    const level = parseInt(a.label, 10);
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;

    Matter.World.remove(world, a);
    Matter.World.remove(world, b);
    itemData.delete(a.id); itemData.delete(b.id);
    mergingIds.delete(idA); mergingIds.delete(idB);

    score += CFG.MERGE_SCORES[level];

    if (level < 10) {
      // 다음 단계 아이템 생성
      createItem(level + 1, mx, my, false);
      SoundManager.playMerge(level);
    } else {
      // monring11 + monring11 → 소멸
      ParticleSystem.spawnExplosion(mx, my, CFG.ITEM_COLORS[level]);
      SoundManager.playExplosion();
    }

    pendingMerges.delete(key);
  }
}

/* ============================================================
   ParticleSystem
   ============================================================ */
const ParticleSystem = (() => {
  const particles = [];

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < CFG.PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / CFG.PARTICLE_COUNT + Math.random() * 0.5;
      const speed = CFG.PARTICLE_SPEED_MIN +
                    Math.random() * (CFG.PARTICLE_SPEED_MAX - CFG.PARTICLE_SPEED_MIN);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        radius: 4 + Math.random() * 7,
        color,
        life: CFG.PARTICLE_LIFE,
        maxLife: CFG.PARTICLE_LIFE,
      });
    }
  }

  function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function render(ctx) {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return { spawnExplosion, update, render };
})();

/* ============================================================
   GameOverDetector
   ============================================================ */
let gameOverTimer = 0;
let gameState     = 'PLAYING';

function updateSettleStatus(now) {
  for (const [id, data] of itemData) {
    if (data.isSettled) continue;
    const elapsed = now - data.droppedAt;
    if (elapsed > CFG.SETTLE_GRACE) { data.isSettled = true; continue; }
    // parent === body 인 최상위 바디만 찾음
    const body = Matter.Composite.allBodies(world).find(b => b.id === id && b.parent === b);
    if (body) {
      const spd = Math.hypot(body.velocity.x, body.velocity.y);
      if (spd < CFG.SETTLE_SPEED && elapsed > 500) data.isSettled = true;
    }
  }
}

function checkGameOver(dt) {
  if (gameState !== 'PLAYING') return;
  let overflowing = false;
  for (const body of Matter.Composite.allBodies(world)) {
    // part 바디는 건너뜀 (부모 바디만 체크)
    if (body.isStatic || body.parent !== body) continue;
    const data = itemData.get(body.id);
    if (!data || !data.isSettled) continue;
    const r = CFG.ITEM_RADII[data.level] * 0.85;
    if (body.position.y - r < CFG.DANGER_Y) { overflowing = true; break; }
  }
  if (overflowing) {
    gameOverTimer += dt;
    if (gameOverTimer >= CFG.GAMEOVER_DELAY) triggerGameOver();
  } else {
    gameOverTimer = 0;
  }
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  document.getElementById('finalScore').textContent = score.toLocaleString();
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

/* ============================================================
   Renderer — Canvas 2D
   ============================================================ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function drawItem(body, level) {
  const renderR = CFG.ITEM_RADII[level];
  const { x, y } = body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  if (images[level]) {
    ctx.drawImage(images[level], -renderR, -renderR, renderR * 2, renderR * 2);
  } else {
    ctx.fillStyle = CFG.ITEM_COLORS[level];
    ctx.beginPath(); ctx.arc(0, 0, renderR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

function drawBox() {
  const L = CFG.BOX_LEFT, R = CFG.BOX_RIGHT, T = CFG.BOX_TOP, B = CFG.BOX_BOTTOM;
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(L, T, R - L, B - T);
  ctx.strokeStyle = '#3a7bd5'; ctx.lineWidth = 3;
  ctx.strokeRect(L, T, R - L, B - T);

  // 하단 크레딧 + 저작권 고지
  ctx.save();
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.textAlign = 'center';
  ctx.fillText(
    'made by UnyuWaffle  |  비영리 개인 학습용 팬 프로젝트  |  캐릭터 이미지 저작권 © 넷마블',
    (L + R) / 2, CFG.H - 6
  );
  ctx.restore();
}

function drawDangerLine() {
  ctx.save();
  ctx.strokeStyle = 'rgba(233,69,96,0.85)';
  ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(CFG.BOX_LEFT, CFG.DANGER_Y);
  ctx.lineTo(CFG.BOX_RIGHT, CFG.DANGER_Y);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawGuide(x) {
  if (x < CFG.BOX_LEFT + 5 || x > CFG.BOX_RIGHT - 5) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x, CFG.DANGER_Y + 4); ctx.lineTo(x, CFG.BOX_BOTTOM);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawDropPreview(level, x) {
  const r = CFG.ITEM_RADII[level];
  const cx = Math.max(CFG.BOX_LEFT + r, Math.min(CFG.BOX_RIGHT - r, x));
  const cy = CFG.BOX_TOP - r - 10;
  ctx.save(); ctx.globalAlpha = 0.75;
  if (images[level]) {
    ctx.drawImage(images[level], cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = CFG.ITEM_COLORS[level];
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * 우측 패널 렌더
 * - SCORE, NEXT 미리보기, ev_ex.png 합치기 가이드 모두 고정 Y 좌표 사용
 */
function drawPanel(nextLevel) {
  const PX  = CFG.PANEL_X;
  const PW  = CFG.W - PX - 8;
  const PCX = PX + PW / 2;

  // 패널 배경
  ctx.fillStyle = 'rgba(13,27,42,0.88)';
  ctx.beginPath();
  ctx.roundRect(PX, 8, PW, CFG.H - 16, 12);
  ctx.fill();
  ctx.strokeStyle = '#3a7bd5'; ctx.lineWidth = 1.5; ctx.stroke();

  // ── SCORE ──
  ctx.fillStyle = '#aac4e8'; ctx.font = 'bold 19px Arial'; ctx.textAlign = 'center';
  ctx.fillText('SCORE', PCX, CFG.PANEL_SCORE_Y);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 30px Arial';
  ctx.fillText(score.toLocaleString(), PCX, CFG.PANEL_SCORE_Y + 42);

  // ── NEXT ──
  ctx.fillStyle = '#aac4e8'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
  ctx.fillText('NEXT', PCX, CFG.PANEL_NEXT_Y);

  // NEXT 아이템: 고정 중심 Y, 최대 반지름 44로 클램프
  const nr  = Math.min(CFG.ITEM_RADII[nextLevel], 44);
  const ncy = CFG.PANEL_PREVIEW_CY; // 고정
  if (images[nextLevel]) {
    ctx.drawImage(images[nextLevel], PCX - nr, ncy - nr, nr * 2, nr * 2);
  } else {
    ctx.fillStyle = CFG.ITEM_COLORS[nextLevel];
    ctx.beginPath(); ctx.arc(PCX, ncy, nr, 0, Math.PI * 2); ctx.fill();
  }

  // ── 합치기 가이드 이미지 (ev_ex.png) — 고정 위치 ──
  const guideTop = CFG.PANEL_GUIDE_TOP;          // 고정
  const guideBot = CFG.H - 16 - 8;
  const guideH   = guideBot - guideTop;
  const guideW   = PW - 16;

  if (sampleImg && guideH > 20) {
    const imgAspect = sampleImg.width / sampleImg.height;
    let dw = guideW, dh = guideW / imgAspect;
    if (dh > guideH) { dh = guideH; dw = guideH * imgAspect; }
    const dx = PX + (PW - dw) / 2;
    const dy = guideTop + (guideH - dh) / 2;
    ctx.drawImage(sampleImg, dx, dy, dw, dh);
  }

  // ── 게임 오버 카운트다운 ──
  if (gameOverTimer > 0 && gameState === 'PLAYING') {
    const remaining = Math.ceil((CFG.GAMEOVER_DELAY - gameOverTimer) / 1000);
    ctx.fillStyle = '#e94560'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${remaining}`, PCX, CFG.PANEL_GUIDE_TOP - 10);
  }

  ctx.textAlign = 'left';
}

function render(cursorX, currentLevel, nextLevel) {
  ctx.fillStyle = '#070f1a';
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  drawBox();
  drawDangerLine();
  drawGuide(cursorX);
  drawDropPreview(currentLevel, cursorX);

  const bodies = Matter.Composite.allBodies(world);
  for (const body of bodies) {
    if (body.isStatic || body.parent !== body) continue;  // part 바디 제외
    const data = itemData.get(body.id);
    if (!data) continue;
    drawItem(body, data.level);
  }

  ParticleSystem.render(ctx);
  drawPanel(nextLevel);
}

/* ============================================================
   입력 처리
   ============================================================ */
let cursorX      = (CFG.BOX_LEFT + CFG.BOX_RIGHT) / 2;
let lastDropTime = 0;
let currentLevel = 0;
let nextLevel    = 0;

function pickRandomLevel() {
  // 작은 아이템(0~4)만 투하 허용
  return Math.floor(Math.random() * 5);
}

function dropItem(logX) {
  if (gameState !== 'PLAYING') return;
  if (Date.now() - lastDropTime < CFG.DROP_COOLDOWN) return;

  const r = CFG.ITEM_RADII[currentLevel];
  const cx = Math.max(CFG.BOX_LEFT + r, Math.min(CFG.BOX_RIGHT - r, logX));
  createItem(currentLevel, cx, CFG.BOX_TOP - r, true);
  SoundManager.playDrop();
  lastDropTime  = Date.now();
  currentLevel  = nextLevel;
  nextLevel     = pickRandomLevel();
}

canvas.addEventListener('mousemove', (e) => {
  cursorX = ScaleManager.toLogical(e.clientX, e.clientY).x;
});
canvas.addEventListener('click', (e) => {
  dropItem(ScaleManager.toLogical(e.clientX, e.clientY).x);
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  cursorX = ScaleManager.toLogical(e.touches[0].clientX, e.touches[0].clientY).x;
}, { passive: false });
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const p = ScaleManager.toLogical(e.touches[0].clientX, e.touches[0].clientY);
  cursorX = p.x; dropItem(p.x);
}, { passive: false });

/* ============================================================
   게임 오버 — 다시 시작
   ============================================================ */
document.getElementById('restartBtn').addEventListener('click', resetGame);

/* ============================================================
   GameController — 메인 루프
   ============================================================ */
let lastTimestamp = 0;

function gameLoop(timestamp) {
  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (gameState === 'PLAYING') {
    Matter.Engine.update(engine, 1000 / 60);
    processMerges();
    updateSettleStatus(timestamp);
    checkGameOver(dt);
  }
  ParticleSystem.update();
  render(cursorX, currentLevel, nextLevel);
  requestAnimationFrame(gameLoop);
}

function initGame() {
  score         = 0;
  gameState     = 'PLAYING';
  gameOverTimer = 0;
  currentLevel  = pickRandomLevel();
  nextLevel     = pickRandomLevel();
  initPhysics();
  setupCollisionEvents();
}

function resetGame() {
  if (world) { Matter.World.clear(world); Matter.Engine.clear(engine); }
  itemData.clear(); pendingMerges.clear(); mergingIds.clear();
  document.getElementById('gameOverOverlay').classList.add('hidden');
  score         = 0;
  gameState     = 'PLAYING';
  gameOverTimer = 0;
  currentLevel  = pickRandomLevel();
  nextLevel     = pickRandomLevel();
  lastDropTime  = 0;
  initPhysics();
  setupCollisionEvents();
}

/* ============================================================
   게임 시작
   ============================================================ */
loadImages().then(() => {
  initGame();
  requestAnimationFrame((ts) => { lastTimestamp = ts; gameLoop(ts); });
});
