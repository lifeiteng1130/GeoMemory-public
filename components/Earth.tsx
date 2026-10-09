import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, PixelRatio } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { MemoryWithImages } from '../lib/database';
import { getFullPath } from '../lib/storage';

// 高德 Web端(JS API) Key + 安全密钥（地球/地图展示）
// 申请：https://console.amap.com/dev/key/app
// 添加 Key 时「服务平台」选【Web端(JS API)】
// AMAP_KEY = Key；AMAP_SECRET = 该 Key 对应的「安全密钥」
const AMAP_KEY = 'xxx';
const AMAP_SECRET = 'xxx';

function generateHtml(dpr: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; }
#container { width: 100%; height: 100%; background: #1a1a2e; }
html, body { background: #1a1a2e; }
#loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  color: #4af; font: 14px sans-serif; pointer-events: none; z-index: 10; }
.marker-wrap { position: relative; cursor: pointer; }
.marker-dot { width: 20px; height: 20px; border-radius: 50%; background: #00ffcc;
  box-shadow: 0 0 10px #00ffcc, 0 0 24px rgba(0,255,204,0.6); border: 2px solid #fff;
  animation: pulse 2s infinite; }
@keyframes pulse {
  0% { box-shadow: 0 0 10px #00ffcc, 0 0 24px rgba(0,255,204,0.6); }
  50% { box-shadow: 0 0 16px #00ffcc, 0 0 36px rgba(0,255,204,0.8); }
  100% { box-shadow: 0 0 10px #00ffcc, 0 0 24px rgba(0,255,204,0.6); }
}
.marker-thumb { width: 48px; height: 48px; border-radius: 50%; border: 3px solid #00ffcc;
  object-fit: cover; box-shadow: 0 0 12px rgba(0,255,204,0.5); background: #222; }
.marker-line { position: absolute; left: 50%; bottom: 0; width: 2px; height: 30px;
  background: linear-gradient(to top, #00ffcc, transparent); transform: translateX(-50%); }
</style>
</head>
<body>
<div id="loading">Loading Map...</div>
<div id="container"></div>
<script>
window._AMapSecurityConfig = { securityJsCode: '${AMAP_SECRET}' };
var DEVICE_DPR = ${dpr};
var map = null;
var markers = [];
var thumbs = {};
var currentLayer = 'standard';
var satelliteLayer = null;
var roadNetLayer = null;

function initMap() {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'INIT_START dpr=' + DEVICE_DPR }));

    satelliteLayer = new AMap.TileLayer({
      getTileUrl: function(x, y, z) {
        var s = (Math.abs(x + y) % 4) + 1;
        return 'https://wprd0' + s + '.is.autonavi.com/appmaptile?x=' + x + '&y=' + y + '&z=' + z + '&scl=2&style=6';
      },
      tileSize: 256,
      zooms: [2, 18]
    });
    roadNetLayer = new AMap.TileLayer.RoadNet();

    map = new AMap.Map('container', {
      viewMode: '3D',
      zoom: 4.5,
      center: [104, 35],
      mapStyle: 'amap://styles/normal',
      buildingAnimation: true,
      expandZoomRange: true,
      zooms: [3, 18],
      pitch: 0,
      rotation: 0,
      showBuildingBlock: true,
      pixelRatio: DEVICE_DPR,
      // Prevent scrolling beyond tile coverage
      dragEnable: true,
      resizeEnable: true
    });

    // Prevent scrolling beyond reasonable bounds
    map.setZooms([3, 18]);

    map.on('complete', function() {
      document.getElementById('loading').style.display = 'none';
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'map_ready' }));
    });

    map.on('error', function(e) {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'Map error: ' + (e.message || JSON.stringify(e)) }));
    });

    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'INIT_OK' }));
  } catch(e) {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'INIT_ERR: ' + e.message + ' stack: ' + e.stack }));
  }
}

function switchLayer(type) {
  if (!map || currentLayer === type) return;
  try {
    if (type === 'satellite') {
      map.addLayer(satelliteLayer);
      map.addLayer(roadNetLayer);
    } else {
      try { map.removeLayer(satelliteLayer); } catch(e) {}
      try { map.removeLayer(roadNetLayer); } catch(e) {}
      map.setMapStyle(type === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal');
    }
    currentLayer = type;
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'layer_switched', layer: type }));
  } catch(e) {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'SWITCH_ERR: ' + e.message }));
  }
}

function addMarkers(points) {
  markers.forEach(function(m) { m.setMap(null); });
  markers = [];
  thumbs = {};

  points.forEach(function(p, i) {
    var marker = new AMap.Marker({
      position: [p.lng, p.lat],
      offset: new AMap.Pixel(-10, -10),
      content: '<div class="marker-wrap"><div class="marker-dot"></div></div>',
      extData: { id: p.id },
      zIndex: 100 + i
    });

    marker.on('click', function() {
      var data = this.getExtData();
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'point_click', id: data.id }));
    });

    marker.setMap(map);
    markers.push(marker);
    thumbs[p.id] = marker;
  });

  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'MARKERS_ADDED:' + points.length }));
}

function addThumbnail(id, base64) {
  var marker = thumbs[id];
  if (!marker) return;

  var content = '<div class="marker-wrap">' +
    '<img class="marker-thumb" src="' + base64 + '" />' +
    '</div>';

  marker.setContent(content);
  marker.setOffset(new AMap.Pixel(-24, -54));
  marker.setzIndex(200);
}

window.addEventListener('message', function(e) {
  try {
    var data = JSON.parse(e.data);
    if (data.type === 'add_markers') {
      addMarkers(data.points);
    } else if (data.type === 'add_thumb') {
      addThumbnail(data.id, data.base64);
    } else if (data.type === 'switch_layer') {
      switchLayer(data.layer);
    }
  } catch (err) {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'MSG_ERR: ' + err.message }));
  }
});
setTimeout(function() {
  if (!map) {
    document.getElementById('loading').innerHTML = '地图加载失败';
    document.getElementById('loading').style.color = '#ff6b6b';
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'MAP_TIMEOUT' }));
  }
}, 15000);
</script>
<script>
var s = document.createElement('script');
s.src = 'https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.ToolBar,AMap.Scale&callback=initMap';
s.onerror = function() {
  document.getElementById('loading').innerHTML = '脚本加载失败';
  document.getElementById('loading').style.color = '#ff6b6b';
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', msg: 'SCRIPT_LOAD_ERR' }));
};
document.body.appendChild(s);
</script>
</body>
</html>`;
}

interface EarthProps {
  memories: MemoryWithImages[];
  onPointPress: (id: string) => void;
  onLayerChange?: (layer: string) => void;
}

export default function Earth({ memories, onPointPress, onLayerChange }: EarthProps) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [layerType, setLayerType] = useState<'standard' | 'satellite' | 'dark'>('standard');
  const thumbsSentRef = useRef<Set<string>>(new Set());

  const dpr = PixelRatio.get();
  const htmlSource = useMemo(() => ({ html: generateHtml(dpr) }), [dpr]);
  const injectedJS = useMemo(() => `window.devicePixelRatio = ${dpr};`, [dpr]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'point_click' && data.id) {
        onPointPress(data.id);
      } else if (data.type === 'map_ready') {
        console.log('[Earth] Amap ready');
        setReady(true);
      } else if (data.type === 'layer_switched') {
        setLayerType(data.layer);
      } else if (data.type === 'error') {
        console.log('[Earth] WV:', data.msg);
      }
    } catch {}
  }, [onPointPress]);

  // Send markers
  useEffect(() => {
    if (!ready || !webViewRef.current || memories.length === 0) return;
    thumbsSentRef.current.clear();
    const points = memories.map(m => ({ id: m.id, lat: m.latitude, lng: m.longitude }));
    console.log('[Earth] Sending markers:', points.length);
    const js = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify({ type: 'add_markers', points }))} }));`;
    // Small delay ensures map's JS context is fully ready after page load
    const timer = setTimeout(() => webViewRef.current?.injectJavaScript(js), 200);
    return () => clearTimeout(timer);
  }, [memories, ready]);

  const switchToLayer = useCallback((type: string) => {
    const js = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify({ type: 'switch_layer', layer: type }))} }));`;
    webViewRef.current?.injectJavaScript(js);
    onLayerChange?.(type);
  }, [onLayerChange]);

  // Send thumbnails
  useEffect(() => {
    if (!ready || memories.length === 0) return;
    let cancelled = false;
    const sendThumbs = async () => {
      for (const m of memories) {
        if (cancelled || !m.images.length) continue;
        if (thumbsSentRef.current.has(m.id)) continue;
        try {
          const fullPath = getFullPath(m.images[0].file_path);
          // verify file exists before reading
          const info = await FileSystem.getInfoAsync(fullPath);
          if (!info.exists) {
            console.log('[Earth] thumb file not found:', fullPath);
            continue;
          }
          const b64 = await FileSystem.readAsStringAsync(fullPath, { encoding: FileSystem.EncodingType.Base64 });
          if (!b64 || b64.length < 100) continue;
          if (cancelled) return;
          const ext = m.images[0].file_path.split('.').pop()?.toLowerCase() || 'jpg';
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          const dataUri = `data:${mime};base64,${b64}`;
          const payload = JSON.stringify({ type: 'add_thumb', id: m.id, base64: dataUri });
          const js = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(payload)} }));`;
          webViewRef.current?.injectJavaScript(js);
          thumbsSentRef.current.add(m.id);
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          console.error('[Earth] thumb error:', m.id, String(e));
        }
      }
    };
    // Wait for markers (200ms) to be fully created before sending thumbnails
    const timer = setTimeout(sendThumbs, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [memories, ready]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={htmlSource}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        originWhitelist={['*']}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        onHttpError={(e) => console.log('[Earth] HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url)}
        onError={(e) => console.log('[Earth] WebView error:', e.nativeEvent.description, e.nativeEvent.url)}
        onLoadEnd={() => console.log('[Earth] WebView page loaded')}
      />
      {ready && (
        <View style={styles.layerSwitcher}>
          <TouchableOpacity
            style={[styles.layerBtn, layerType === 'standard' && styles.layerBtnActive]}
            onPress={() => switchToLayer('standard')}
          >
            <Text style={[styles.layerBtnText, layerType === 'standard' && styles.layerBtnTextActive]}>标准</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerBtn, layerType === 'dark' && styles.layerBtnActive]}
            onPress={() => switchToLayer('dark')}
          >
            <Text style={[styles.layerBtnText, layerType === 'dark' && styles.layerBtnTextActive]}>暗色</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerBtn, layerType === 'satellite' && styles.layerBtnActive]}
            onPress={() => switchToLayer('satellite')}
          >
            <Text style={[styles.layerBtnText, layerType === 'satellite' && styles.layerBtnTextActive]}>卫星</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
  layerSwitcher: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    flexDirection: 'column',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  layerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  layerBtnActive: {
    backgroundColor: '#007AFF',
  },
  layerBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  layerBtnTextActive: {
    color: '#fff',
  },
});
