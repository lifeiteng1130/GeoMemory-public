import React, { useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { PixelRatio } from 'react-native';

// 高德 Web端(JS API) Key + 安全密钥（微调位置地图）
// 申请：https://console.amap.com/dev/key/app
// 必须与 Earth.tsx 使用同一对 Key / 安全密钥
const AMAP_KEY = 'xxx';
const AMAP_SECRET = 'xxx';

function generateHtml(dpr: number, lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a2e; }
#container { width: 100%; height: 100%; }
.crosshair { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 32px; height: 32px; pointer-events: none; z-index: 100; }
.crosshair::before { content: ''; position: absolute; top: 50%; left: 0; right: 0;
  height: 2px; background: #ff3b30; }
.crosshair::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0;
  width: 2px; background: #ff3b30; }
.info { position: absolute; bottom: 16px; left: 0; right: 0; text-align: center;
  pointer-events: none; z-index: 100; }
.info span { background: rgba(0,0,0,0.7); color: #fff; padding: 6px 14px; border-radius: 14px;
  font: 13px monospace; }
</style>
</head>
<body>
<div id="container"></div>
<div class="crosshair"></div>
<div class="info"><span id="coords"></span></div>
<script>
window._AMapSecurityConfig = { securityJsCode: '${AMAP_SECRET}' };
var DEVICE_DPR = ${dpr};
var map = null;
var marker = null;

function initMap() {
  map = new AMap.Map('container', {
    zoom: 16,
    center: [${lng}, ${lat}],
    mapStyle: 'amap://styles/normal',
    pixelRatio: DEVICE_DPR,
    showBuildingBlock: true
  });

  marker = new AMap.Marker({
    position: [${lng}, ${lat}],
    draggable: true,
    offset: new AMap.Pixel(-12, -32),
    content: '<div style="font-size:28px;line-height:1;">📍</div>',
    zIndex: 200
  });
  marker.setMap(map);

  var updateCoords = function() {
    var pos = marker.getPosition();
    document.getElementById('coords').textContent =
      pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6);
  };

  marker.on('dragend', function() {
    updateCoords();
  });

  map.on('moveend', function() {
    var c = map.getCenter();
    marker.setPosition(c);
    updateCoords();
  });

  map.on('zoomend', function() {
    var c = map.getCenter();
    marker.setPosition(c);
    updateCoords();
  });

  updateCoords();

  map.on('complete', function() {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
  });
}

function getPosition() {
  var pos = marker.getPosition();
  return { lat: pos.lat, lng: pos.lng };
}

window.addEventListener('message', function(e) {
  try {
    var data = JSON.parse(e.data);
    if (data.type === 'get_position') {
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'position', lat: getPosition().lat, lng: getPosition().lng
      }));
    }
  } catch(err) {}
});
</script>
<script>
var s = document.createElement('script');
s.src = 'https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=initMap';
document.body.appendChild(s);
</script>
</body>
</html>`;
}

interface MapAdjusterProps {
  visible: boolean;
  latitude: number;
  longitude: number;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export default function MapAdjuster({ visible, latitude, longitude, onConfirm, onCancel }: MapAdjusterProps) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const dpr = PixelRatio.get();
  const htmlSource = React.useMemo(
    () => ({ html: generateHtml(dpr, latitude, longitude) }),
    [dpr, latitude, longitude]
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setReady(true);
      } else if (data.type === 'position') {
        onConfirm(data.lat, data.lng);
      }
    } catch {}
  }, [onConfirm]);

  const handleConfirm = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'position',
        lat: marker.getPosition().lat,
        lng: marker.getPosition().lng
      }));
    `);
  }, []);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelBtn}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.title}>拖动地图微调位置</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>确认</Text>
          </TouchableOpacity>
        </View>

        {!ready && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>加载地图中...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={htmlSource}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
        />

        <View style={styles.hint}>
          <Text style={styles.hintText}>拖动地图，十字准星对准目标位置后点击确认</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: { color: '#ff3b30', fontSize: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 60,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
  hint: {
    padding: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  hintText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
});
