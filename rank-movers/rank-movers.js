/* RankMovers — shared rank-movers UI for the Momentarium analytics dashboards.
 *
 * One codebase, two platforms: the Vercel dashboard and the Spaces dashboard
 * render the exact same UI from this file. Do not copy it into either
 * dashboard; both load it from GitHub at runtime:
 *   https://cdn.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.js
 *   https://cdn.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.css
 * (jsDelivr caches the main branch for a while; for an urgent update purge it at
 * https://purge.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.js)
 *
 * No dependencies, no network calls, no framework. The host passes the data.
 *
 * Canonical mover shape:
 *   { appId, app, keyword, locale, kind, from, to }
 *   appId    — numeric App Store id (groups movers; optional, falls back to app)
 *   app      — full app name; shortened with the same rule on both platforms
 *   keyword  — the search term
 *   locale   — e.g. 'en-US'
 *   kind     — 'up' | 'down' | 'new' | 'out' ('entered' and 'dropped' also accepted)
 *   from     — previous rank (number) or null
 *   to       — current rank (number) or null
 *
 *   new: from=null, to=rank · out: from=rank, to=null · up/down: both ranks.
 *
 * Host wiring:
 *   RankMovers.render(containerElement, movers, {
 *     appUrl: function (appId, shortName) { return '#/app/' + appId; } // optional
 *   });
 * appUrl may return null to render the group header without a link.
 *
 * Behaviour (identical on both platforms):
 * - groups by app, short name once in the header, with ▲/▼/NEW/OUT counters
 * - groups sorted by mover count, then biggest shift; rows by biggest shift
 * - filter buttons with counts: All / Gainers / Losers / New in top-200 / Dropped out
 * - default 5 groups x 5 rows; per-group "Show all N for …" and "Show all N apps"
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var MAX_GROUPS = 5;
  var MAX_ROWS = 5;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Short app name. Same rule as the Vercel dashboard's lib/util.js shortName,
   * kept here so both platforms shorten identically. */
  function shortName(full) {
    var n = String(full || '');
    n = n.replace(' Practice Test 2026 DOL', ' DMV').replace(' Practice Test 2026 Prep', ' DMV');
    n = n.replace(' PennDOT Practice 2026', ' DMV').replace(' DPS Practice Test 2026', ' DMV');
    n = n.replace('Motion Stitch: Align Photos', 'Motion Stitch');
    n = n.replace('Taptum: Rhythm Ear Training', 'Taptum');
    n = n.replace('Opa! Bilingual Book Reader', 'Opa!');
    n = n.replace('USCIS US Naturalization Test', 'USCIS');
    n = n.replace('Overlaid: Slide Carousel Maker', 'Overlaid');
    n = n.replace('FlowState Cycle Synced Fitness', 'FlowState');
    n = n.replace('PriceLocus: App Price Localize', 'PriceLocus');
    n = n.replace('StoreSync: Metadata Manager', 'StoreSync');
    n = n.replace('Boxing Trainer: Punch Master', 'Boxing');
    n = n.replace('CoreData Studio: SQLite Editor', 'CoreData');
    n = n.replace('Caelum: Spatial Planetarium', 'Caelum');
    n = n.replace('Sky Scooper: Fire Rescue', 'Sky Scooper');
    n = n.replace('AppScreen Studio Design Mockup', 'AppScreen');
    n = n.replace(/\bDMV( DMV)+/g, 'DMV');
    return n.trim();
  }

  function normKind(k) {
    if (k === 'entered') return 'new';
    if (k === 'dropped') return 'out';
    if (k === 'up' || k === 'down' || k === 'new' || k === 'out') return k;
    return null;
  }

  /* Shift size for sorting: entering/leaving the top-200 counts as the
   * biggest move (200), otherwise |delta|. */
  function shiftOf(m) {
    if (m.kind === 'new' || m.kind === 'out') return 200;
    if (typeof m.from === 'number' && typeof m.to === 'number') return Math.abs(m.from - m.to);
    return 0;
  }

  function normalize(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var m = list[i] || {};
      var kind = normKind(m.kind);
      if (!kind || !m.keyword) continue;
      out.push({
        appId: (m.appId == null ? m.app_id : m.appId),
        app: m.app || m.app_name || '?',
        keyword: String(m.keyword),
        locale: m.locale || '',
        kind: kind,
        from: (typeof m.from === 'number' ? m.from : (typeof m.prev_position === 'number' ? m.prev_position : null)),
        to: (typeof m.to === 'number' ? m.to : (typeof m.position === 'number' ? m.position : null))
      });
    }
    return out;
  }

  function groupOf(m) {
    return (m.appId != null ? 'id:' + m.appId : 'name:' + m.app);
  }

  function changeHtml(m) {
    if (m.kind === 'new') return '<span class="rm-chg rm-up">NEW #' + m.to + '</span>';
    if (m.kind === 'out') return '<span class="rm-chg rm-dn">OUT was #' + m.from + '</span>';
    var up = m.to < m.from;
    var d = Math.abs(m.from - m.to);
    return '<span class="rm-chg ' + (up ? 'rm-up' : 'rm-dn') + '">#' + m.from + ' &rarr; <b>#' + m.to + '</b> ' +
      (up ? '&uarr;' : '&darr;') + d + '</span>';
  }

  function rowHtml(m) {
    return '<li class="rm-row">' +
      '<span class="rm-kw">&laquo;' + esc(m.keyword) + '&raquo;</span>' +
      (m.locale ? ' <span class="rm-loc">' + esc(m.locale) + '</span>' : '') +
      changeHtml(m) +
      '</li>';
  }

  function countsHtml(counts) {
    var parts = [];
    if (counts.up) parts.push('<span class="rm-cnt rm-up">&uarr; ' + counts.up + '</span>');
    if (counts.down) parts.push('<span class="rm-cnt rm-dn">&darr; ' + counts.down + '</span>');
    if (counts['new']) parts.push('<span class="rm-cnt rm-up">NEW ' + counts['new'] + '</span>');
    if (counts.out) parts.push('<span class="rm-cnt rm-dn">OUT ' + counts.out + '</span>');
    return parts.join(' ');
  }

  function render(container, movers, opts) {
    opts = opts || {};
    var appUrl = opts.appUrl || null;
    var data = normalize(movers);
    var state = { filter: 'all', expanded: {}, showAllGroups: false };

    function filtered() {
      if (state.filter === 'all') return data;
      return data.filter(function (m) { return m.kind === state.filter; });
    }

    function counts(list) {
      var c = { up: 0, down: 0, 'new': 0, out: 0 };
      for (var i = 0; i < list.length; i++) c[list[i].kind]++;
      return c;
    }

    function buildGroups(list) {
      var map = {}, order = [];
      for (var i = 0; i < list.length; i++) {
        var m = list[i], key = groupOf(m);
        if (!map[key]) { map[key] = { key: key, appId: m.appId, app: m.app, rows: [] }; order.push(key); }
        map[key].rows.push(m);
      }
      var groups = order.map(function (k) { return map[k]; });
      for (var j = 0; j < groups.length; j++) {
        var g = groups[j];
        g.rows.sort(function (a, b) {
          return (shiftOf(b) - shiftOf(a)) || (a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0);
        });
        g.maxShift = 0;
        for (var k = 0; k < g.rows.length; k++) g.maxShift = Math.max(g.maxShift, shiftOf(g.rows[k]));
        g.counts = counts(g.rows);
        g.short = shortName(g.app);
      }
      groups.sort(function (a, b) {
        return (b.rows.length - a.rows.length) || (b.maxShift - a.maxShift) ||
          (a.short < b.short ? -1 : a.short > b.short ? 1 : 0);
      });
      return groups;
    }

    function draw() {
      var all = data;
      var list = filtered();
      var total = counts(all);
      var html = '<div class="rm-card"><h2>Rank movers</h2>';
      if (!all.length) {
        html += '<p class="rm-note">No rank movers today.</p></div>';
        container.innerHTML = html;
        return;
      }
      html += '<p class="rm-note">Showing ' + list.length + ' of ' + all.length +
        ' movers today (new in top-200, dropped, or moved &ge;30).</p>';
      html += '<div class="rm-filters" role="group" aria-label="Filter movers">';
      var filters = [
        ['all', 'All', all.length],
        ['up', 'Gainers', total.up],
        ['down', 'Losers', total.down],
        ['new', 'New in top-200', total['new']],
        ['out', 'Dropped out', total.out]
      ];
      for (var f = 0; f < filters.length; f++) {
        var fl = filters[f];
        html += '<button type="button" class="rm-filter' + (state.filter === fl[0] ? ' on' : '') +
          '" data-filter="' + fl[0] + '">' + fl[1] + ' &middot; ' + fl[2] + '</button>';
      }
      html += '</div>';
      var groups = buildGroups(list);
      var shown = state.showAllGroups ? groups : groups.slice(0, MAX_GROUPS);
      html += '<div class="rm-groups">';
      for (var gi = 0; gi < shown.length; gi++) {
        var g = shown[gi];
        var isOpen = !!state.expanded[g.key];
        var rows = isOpen ? g.rows : g.rows.slice(0, MAX_ROWS);
        var url = appUrl ? appUrl(g.appId, g.short) : null;
        var title = url ? '<a href="' + esc(url) + '">' + esc(g.short) + '</a>' : esc(g.short);
        html += '<section class="rm-group"><header class="rm-group-h">' + title +
          ' <span class="rm-group-counts">' + countsHtml(g.counts) + '</span></header>' +
          '<ul class="rm-rows">' + rows.map(rowHtml).join('') + '</ul>';
        if (g.rows.length > MAX_ROWS) {
          html += '<button type="button" class="rm-more" data-group="' + esc(g.key) + '">' +
            (isOpen ? 'Show less' : 'Show all ' + g.rows.length + ' for ' + esc(g.short)) + '</button>';
        }
        html += '</section>';
      }
      html += '</div>';
      if (groups.length > MAX_GROUPS) {
        html += '<p class="rm-more-wrap"><button type="button" class="rm-more" data-all="1">' +
          (state.showAllGroups ? 'Show less' : 'Show all ' + groups.length + ' apps') + '</button></p>';
      }
      html += '</div>';
      container.innerHTML = html;
      wire();
    }

    function wire() {
      var btns = container.querySelectorAll('[data-filter]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (e) {
          state.filter = e.currentTarget.getAttribute('data-filter');
          draw();
        });
      }
      var mores = container.querySelectorAll('[data-group]');
      for (var j = 0; j < mores.length; j++) {
        mores[j].addEventListener('click', function (e) {
          var k = e.currentTarget.getAttribute('data-group');
          state.expanded[k] = !state.expanded[k];
          draw();
        });
      }
      var allBtn = container.querySelector('[data-all]');
      if (allBtn) {
        allBtn.addEventListener('click', function () {
          state.showAllGroups = !state.showAllGroups;
          draw();
        });
      }
    }

    draw();
    return { version: VERSION };
  }

  global.RankMovers = { render: render, shortName: shortName, version: VERSION };
})(typeof window !== 'undefined' ? window : this);
