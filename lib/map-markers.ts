// Shared verbatim with the WebView; kept separate so reconciliation can be tested.
export const markerScript = String.raw`
var markerEntries = Object.create(null);
var markerRevision = 0;
var dotContent = '<div class="marker-wrap"><div class="marker-dot"></div></div>';

function syncMarkers(points, revision) {
  markerRevision = revision;
  var wanted = Object.create(null);
  var missing = [];
  points.forEach(function(p, i) {
    wanted[p.id] = true;
    var entry = markerEntries[p.id];
    if (!entry) {
      var marker = new AMap.Marker({
        position: [p.lng, p.lat], offset: new AMap.Pixel(-10, -10),
        content: dotContent, extData: { id: p.id }, zIndex: 100 + i
      });
      marker.on('click', function() {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'point_click', id: this.getExtData().id }));
      });
      marker.setMap(map);
      entry = markerEntries[p.id] = { marker: marker, lat: p.lat, lng: p.lng, imageKey: p.imageKey, loaded: false, index: i };
    } else {
      if (entry.lat !== p.lat || entry.lng !== p.lng) {
        entry.marker.setPosition([p.lng, p.lat]);
        entry.lat = p.lat;
        entry.lng = p.lng;
      }
      if (entry.imageKey !== p.imageKey) {
        entry.marker.setContent(dotContent);
        entry.marker.setOffset(new AMap.Pixel(-10, -10));
        entry.marker.setzIndex(100 + i);
        entry.imageKey = p.imageKey;
        entry.loaded = false;
      } else if (!entry.loaded && entry.index !== i) {
        entry.marker.setzIndex(100 + i);
      }
      entry.index = i;
    }
    if (p.imageKey && !entry.loaded) missing.push({ id: p.id, imageKey: p.imageKey });
  });
  Object.keys(markerEntries).forEach(function(id) {
    if (!wanted[id]) {
      markerEntries[id].marker.setMap(null);
      delete markerEntries[id];
    }
  });
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'markers_synced', revision: revision, missing: missing }));
}

function addThumbnail(id, imageKey, revision, base64) {
  var entry = markerEntries[id];
  if (!entry || revision !== markerRevision || entry.imageKey !== imageKey || entry.loaded) return;
  entry.marker.setContent('<div class="marker-wrap"><img class="marker-thumb" src="' + base64 + '" /></div>');
  entry.marker.setOffset(new AMap.Pixel(-24, -54));
  entry.marker.setzIndex(200);
  entry.loaded = true;
}
`;
