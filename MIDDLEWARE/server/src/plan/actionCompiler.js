function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapEntityTypeToAction(entityType) {
  const mapping = {
    warningLight: 'setBlink',
    broadcast: 'broadcast',
    staffGuide: 'dispatchTo',
    staffFire: 'dispatchTo'
  };
  return mapping[entityType] || 'activate';
}

function compileActionQueue(planConfig) {
  const source = planConfig || {};
  const fromSimTime = toFiniteNumber(source.fromSimTime) ?? 0;
  const compiled = [];

  const runtimeActions = (((source.planRuntime || {}).actions) || []);
  runtimeActions.forEach((item, index) => {
    const triggerTime = toFiniteNumber(item && item.startAt);
    if (triggerTime === null) {
      return;
    }

    compiled.push({
      actionId: item.actionId || `runtime_${index + 1}`,
      sourceType: 'planRuntime',
      triggerTime,
      targetId: item.targetId || '',
      action: item.action || '',
      params: item.params || {}
    });
  });

  const specialEntities = (((source.initConfigLike || {}).specialEntities) || []);
  specialEntities.forEach((entity, index) => {
    const triggerTime = toFiniteNumber(entity && entity.triggerAt);
    if (triggerTime === null) {
      return;
    }

    compiled.push({
      actionId: `${entity.entityId || `entity_${index + 1}`}_trigger_${triggerTime}`,
      sourceType: 'specialEntity',
      triggerTime,
      targetId: entity.entityId || '',
      action: mapEntityTypeToAction(entity.entityType),
      params: entity.config || {}
    });
  });

  const timeBounded = compiled.filter((item) => item.triggerTime >= fromSimTime);
  const deduped = [];
  const keySet = new Set();

  timeBounded.forEach((item) => {
    const dedupeKey = `${item.targetId}|${item.action}|${item.triggerTime}`;
    if (keySet.has(dedupeKey)) {
      return;
    }
    keySet.add(dedupeKey);
    deduped.push({
      ...item,
      dedupeKey
    });
  });

  deduped.sort((a, b) => {
    if (a.triggerTime !== b.triggerTime) {
      return a.triggerTime - b.triggerTime;
    }
    return String(a.actionId).localeCompare(String(b.actionId));
  });

  return deduped;
}

module.exports = {
  compileActionQueue
};
