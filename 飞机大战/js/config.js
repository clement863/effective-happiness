(function () {
  const CONFIG = {
    W: 480,
    H: 720,

    PLAYER: {
      speed: 320,
      hp: 100,
      radius: 16,
      fireInterval: 0.16,
      invincibleTime: 0.8,
      maxPower: 5,
      weaponDuration: 10,
      maxEnergy: 100,
      startBombs: 1,
    },

    // 可选战机：不同机型属性差异化（平衡 / 攻击 / 速度 / 防御）
    FIGHTERS: {
      default:   { speed: 320, hp: 100, radius: 16, damage: 1.0,  fireInterval: 0.16, color: '#00e5ff', bulletColor: '#7df9ff', bulletRadius: 4 },
      blaster:   { speed: 300, hp: 90,  radius: 16, damage: 1.4,  fireInterval: 0.14, color: '#ff4d3d', bulletColor: '#ff6b6b', bulletRadius: 5 },
      lightning: { speed: 460, hp: 80,  radius: 14, damage: 0.8,  fireInterval: 0.12, color: '#66b3ff', bulletColor: '#ffe066', bulletRadius: 3 },
      guardian:  { speed: 250, hp: 160, radius: 18, damage: 0.85, fireInterval: 0.18, color: '#66cc66', bulletColor: '#7dffb0', bulletRadius: 6 },
    },

    // 升级界面可选强化（击败 Boss 后三选一）
    UPGRADES: [
      { key: 'power',  name: '火力强化', desc: '火力等级 +1' },
      { key: 'rapid',  name: '急速射击', desc: '攻击间隔 -10%' },
      { key: 'damage', name: '威力提升', desc: '伤害 +10%' },
      { key: 'heal',   name: '紧急维修', desc: '恢复 30 生命' },
      { key: 'shield', name: '能量护盾', desc: '获得 1 层护盾' },
      { key: 'bomb',   name: '补充炸弹', desc: '炸弹 +1' },
      { key: 'speed',  name: '引擎升级', desc: '移动速度 +12%' },
      { key: 'maxhp',  name: '强化装甲', desc: '生命上限 +20' },
    ],

    // 各火力等级的武器形态：dx 为横向偏移，angle 为弹道角度（度），0 表示正上方
    WEAPONS: [
      null,
      { damage: 10, shots: [{ dx: 0, angle: 0 }] },
      { damage: 10, shots: [{ dx: -8, angle: 0 }, { dx: 8, angle: 0 }] },
      { damage: 10, shots: [{ dx: -8, angle: -12 }, { dx: 0, angle: 0 }, { dx: 8, angle: 12 }] },
      { damage: 12, shots: [{ dx: -14, angle: -30 }, { dx: -7, angle: -15 }, { dx: 0, angle: 0 }, { dx: 7, angle: 15 }, { dx: 14, angle: 30 }] },
      { damage: 15, shots: [{ dx: -16, angle: -32 }, { dx: -8, angle: -16 }, { dx: 0, angle: 0 }, { dx: 8, angle: 16 }, { dx: 16, angle: 32 }] },
    ],

    ENEMIES: {
      small:  { hp: 2,  speed: 150, radius: 14, score: 10,  color: '#ff2d78' },
      dive:   { hp: 3,  speed: 260, radius: 14, score: 20,  color: '#ff5ca8' },
      side:   { hp: 5,  speed: 120, radius: 16, score: 30,  color: '#ff8c00' },
      elite:  { hp: 45, speed: 60,  radius: 26, score: 150, color: '#ff6a00' },
      hunter: { hp: 8,  speed: 180, radius: 15, score: 60,  color: '#ffd740' },
    },

    COLORS: {
      bgTop: '#03040c',
      bgBottom: '#0a1030',
      player: '#00e5ff',
      playerBullet: '#aef6ff',
      missile: '#ffb300',
      laser: '#7df9ff',
      enemy: '#ff2d78',
      elite: '#ff8c00',
      boss: '#c084fc',
      enemyBullet: '#ff4da6',
      shield: 'rgba(0, 229, 255, 0.45)',
    },

    // 随机掉落的道具类型（对应 powerup.js 的 META 键）
    POWERUPS: ['power', 'missile', 'laser', 'bomb', 'heal', 'score'],

    // 难度：bossHpBonus 为各难度下 Boss 血量加成（每升一档 +500）
    DIFFICULTY: {
      easy:   { label: '简单', bossHpBonus: 0 },
      normal: { label: '普通', bossHpBonus: 500 },
      hard:   { label: '困难', bossHpBonus: 1000 },
      hell:   { label: '地狱', bossHpBonus: 1500 },
    },

    // 无尽模式：每 rampInterval 秒，出现速度与攻击速度 ×rampFactor
    ENDLESS: {
      baseSpawnInterval: 0.8,
      rampInterval: 15,
      rampFactor: 1.25,
      upgradeInterval: 30,
    },
  };

  window.CONFIG = CONFIG;
})();