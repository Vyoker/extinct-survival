/**
 * Skills Module
 * 3 skill dasar: survivor, hunter, scavenger.
 * Rank: Bronze -> Silver -> Gold -> Platinum -> Diamond -> Master
 * Tiap rank punya 5 tier (I-V, angka romawi).
 * EXP requirement per tier scaling: 100 * 1.5^n (n = urutan tier global, 0-based).
 */
const Skills = (function () {
  'use strict';

  const RANK_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];
  const RANK_COLORS = ['#cd7f32', '#c0c0c0', '#ffd700', '#8fe9e0', '#5fb3ff', '#ff3b3b'];
  const TIERS_PER_RANK = 5;
  const MAX_RANK_INDEX = RANK_NAMES.length - 1; // 5 (Master)
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

  const SKILL_DEFS = {
    survivor: {
      name: 'Survivor',
      icon: '🧟',
      description: 'Kemampuan bertahan hidup: menjaga hunger, thirst, dan sanity. Naik lewat konsumsi item survival.'
    },
    hunter: {
      name: 'Hunter',
      icon: '🏹',
      description: 'Kemampuan bertarung dan berburu. Naik lewat memenangkan pertarungan (Hunting).'
    },
    scavenger: {
      name: 'Scavenger',
      icon: '🧰',
      description: 'Kemampuan mengumpulkan sumber daya. Naik lewat aktivitas Scavenge.'
    }
  };

  function getPlayer() {
    return GameState.get().player;
  }

  // n = urutan tier global (0-based) dari Bronze I (n=0) sampai Master V (n=29)
  function globalTierIndex(rankIndex, tier) {
    return rankIndex * TIERS_PER_RANK + (tier - 1);
  }

  function getRequiredExp(rankIndex, tier) {
    const n = globalTierIndex(rankIndex, tier);
    return Math.round(100 * Math.pow(1.5, n));
  }

  function getSkillLabel(skillState) {
    const rankName = RANK_NAMES[skillState.rank];
    const roman = ROMAN[skillState.tier - 1];
    return `${rankName} ${roman}`;
  }

  function isMaxed(skillState) {
    return skillState.rank >= MAX_RANK_INDEX && skillState.tier >= TIERS_PER_RANK;
  }

  function addSkillExp(skillId, amount) {
    const p = getPlayer();
    const skill = p.skills[skillId];
    if (!skill || isMaxed(skill)) return;

    skill.exp += amount;

    while (!isMaxed(skill)) {
      const required = getRequiredExp(skill.rank, skill.tier);
      if (skill.exp < required) break;

      skill.exp -= required;
      skill.tier += 1;
      if (skill.tier > TIERS_PER_RANK) {
        skill.tier = 1;
        skill.rank += 1;
        Events.emit('notify', { message: `🏅 Skill ${SKILL_DEFS[skillId].name} naik rank: ${RANK_NAMES[skill.rank]}!` });
      } else {
        Events.emit('notify', { message: `⬆️ Skill ${SKILL_DEFS[skillId].name} naik ke ${getSkillLabel(skill)}` });
      }
    }

    if (isMaxed(skill)) skill.exp = 0;
    Events.emit('skills:updated');
  }

  // Bonus stat yang naik seiring rank+tier: n+1 persen
  // (n = urutan tier global, 0-based, Bronze I = 0 -> bonus +1%)
  function getSkillBonusPct(skillId) {
    const p = getPlayer();
    const skill = p.skills[skillId];
    if (!skill) return 0;
    const n = globalTierIndex(skill.rank, skill.tier);
    return n + 1;
  }

  function getSkillBonusLabel(skillId) {
    const pct = getSkillBonusPct(skillId);
    switch (skillId) {
      case 'hunter': return `+${pct}% Drop`;
      case 'scavenger': return `+${pct}% Loot`;
      case 'survivor': return `-${pct}% Energy Drain`;
      default: return '';
    }
  }

  function getRankColor(rankIndex) {
    return RANK_COLORS[rankIndex] || RANK_COLORS[0];
  }

  function getSkillProgress(skillId) {
    const p = getPlayer();
    const skill = p.skills[skillId];
    if (!skill) return null;
    const maxed = isMaxed(skill);
    const required = maxed ? 0 : getRequiredExp(skill.rank, skill.tier);
    return {
      ...skill,
      def: SKILL_DEFS[skillId],
      label: getSkillLabel(skill),
      required,
      maxed,
      progressPct: maxed ? 100 : Math.min(100, Math.round((skill.exp / required) * 100)),
      bonusLabel: getSkillBonusLabel(skillId),
      rankColor: getRankColor(skill.rank)
    };
  }

  function getAllSkillsProgress() {
    return Object.keys(SKILL_DEFS).map(id => ({ id, ...getSkillProgress(id) }));
  }

  return {
    addSkillExp, getSkillProgress, getAllSkillsProgress,
    getSkillLabel, getSkillBonusPct, getSkillBonusLabel, getRankColor,
    RANK_NAMES, RANK_COLORS, ROMAN, SKILL_DEFS
  };
})();

window.Skills = Skills;
