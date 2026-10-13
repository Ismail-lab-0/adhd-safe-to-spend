/* Tiny inline-SVG chart helpers — no CDN chart library (would break the self-contained/
 * no-network invariant). Replace or extend per product; keep charts reading real app
 * state, never sample/placeholder numbers baked into the markup. */
window.App = window.App || {};
App.charts = {
  bar: function (values, labels) {
    var w = 560, h = 200, pad = 28, max = Math.max.apply(null, values.concat([1]));
    var barW = (w - pad * 2) / values.length - 8;
    var bars = values.map(function (v, i) {
      var bh = Math.max(2, (v / max) * (h - pad * 2));
      var x = pad + i * (barW + 8);
      var y = h - pad - bh;
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh +
        '" rx="3" fill="var(--color-accent)"></rect>' +
        '<text x="' + (x + barW / 2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="10" fill="var(--color-ink)">' +
        (labels ? labels[i] : i + 1) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Bar chart">' + bars + '</svg>';
  },
};
