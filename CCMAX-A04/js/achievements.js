window.PG = window.PG || {};

PG.Ach = (function () {
  const list = [
    { id: 'first_fish', ic: '🐟', n: '初尝鲜味', d: '抓到第一条鱼' },
    { id: 'fish_25', ic: '🧺', n: '满载而归', d: '累计抓到 25 条鱼' },
    { id: 'fish_100', ic: '👑', n: '鹈鹕王', d: '累计抓到 100 条鱼' },
    { id: 'combo_5', ic: '🔥', n: '手感火热', d: '达成 5 连击' },
    { id: 'combo_12', ic: '⚡', n: '停不下来', d: '达成 12 连击' },
    { id: 'golden', ic: '✨', n: '金色传说', d: '抓到一条金鱼' },
    { id: 'airfish', ic: '🪽', n: '空中拦截', d: '在空中抓到高处的鱼' },
    { id: 'speed', ic: '💨', n: '海风疾驰', d: '车速达到 55 km/h' },
    { id: 'wheelie', ic: '🦩', n: '翘头大师', d: '展翅抬前轮持续 3 秒' },
    { id: 'dist_1', ic: '🛣️', n: '热身完毕', d: '骑行 1 公里' },
    { id: 'dist_5', ic: '🗺️', n: '海岸长征', d: '骑行 5 公里' },
    { id: 'night', ic: '🌙', n: '星空骑士', d: '在星空月夜中抓到鱼' },
    { id: 'cams', ic: '🎬', n: '导演', d: '用过全部 5 种镜头' },
    { id: 'autopilot', ic: '🤖', n: '放手', d: '自动驾驶抓到 10 条鱼' },
  ];
  let got = {};
  let onUnlock = null;
  try { got = JSON.parse(localStorage.getItem('pelican_ach') || '{}') || {}; } catch (e) { got = {}; }

  function save() { try { localStorage.setItem('pelican_ach', JSON.stringify(got)); } catch (e) {} }
  function has(id) { return !!got[id]; }
  function unlock(id) {
    if (got[id]) return false;
    const a = list.find(x => x.id === id);
    if (!a) return false;
    got[id] = Date.now();
    save();
    render();
    if (onUnlock) onUnlock(a);
    return true;
  }
  function count() { return list.filter(a => got[a.id]).length; }
  function render() {
    const el = document.getElementById('achList');
    if (!el) return;
    el.innerHTML = list.map(a => `<div class="ach${got[a.id] ? ' on' : ''}"><div class="ic">${got[a.id] ? a.ic : '🔒'}</div><div><div>${a.n}</div><div class="d">${a.d}</div></div></div>`).join('');
    document.getElementById('achCount').textContent = `${count()} / ${list.length}`;
  }
  function init(cb) { onUnlock = cb; render(); }

  return { list, init, unlock, has, count, render };
})();
