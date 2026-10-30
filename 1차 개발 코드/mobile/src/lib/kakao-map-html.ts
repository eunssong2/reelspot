export const scriptJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
export function kakaoMapHtml(key: string) {
  return `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body,#map{margin:0;width:100%;height:100%;background:#F2F4F6}#status{position:absolute;inset:0;display:grid;place-items:center;font:14px sans-serif;padding:20px}</style></head><body><div id="map"></div><div id="status">지도를 불러오는 중…</div><script>
  const send=(type,data)=>window.ReactNativeWebView.postMessage(JSON.stringify({type,...data}));
  const failure=()=>{document.getElementById('status').textContent='지도를 불러오지 못했어요. 목록 검색과 직접 등록을 이용해 주세요.';send('error',{});};
  let map,markers=[],pin;
  const timer=setTimeout(failure,15000);
  const sdk=document.createElement('script');
  sdk.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(${scriptJson(key)});
  sdk.onerror=failure;
  sdk.onload=()=>{try{kakao.maps.load(()=>{
    clearTimeout(timer);document.getElementById('status').style.display='none';
    map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(37.5665,126.978),level:6});
    map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);
    kakao.maps.event.addListener(map,'idle',()=>{const c=map.getCenter(),b=map.getBounds(),sw=b.getSouthWest(),ne=b.getNorthEast();send('region',{lat:c.getLat(),lng:c.getLng(),bounds:[sw.getLng(),sw.getLat(),ne.getLng(),ne.getLat()].join(',')});});
    kakao.maps.event.addListener(map,'click',e=>send('pin',{lat:e.latLng.getLat(),lng:e.latLng.getLng()}));
    window.updateMap=(data)=>{
      const c=map.getCenter();if(Math.abs(c.getLat()-data.center.lat)>0.000001||Math.abs(c.getLng()-data.center.lng)>0.000001)map.panTo(new kakao.maps.LatLng(data.center.lat,data.center.lng));
      markers.forEach(m=>m.setMap(null));markers=[];
      data.places.forEach(p=>{const pos=new kakao.maps.LatLng(p.lat,p.lng),m=new kakao.maps.Marker({map,position:pos,title:p.name});markers.push(m);
        kakao.maps.event.addListener(m,'click',()=>send('select',{id:p.id}));
        if(p.id===data.selectedId){const node=document.createElement('div');node.textContent=p.name;node.style.cssText='background:#F1706B;color:white;border-radius:12px;padding:6px 10px;font:14px sans-serif';const overlay=new kakao.maps.CustomOverlay({map,position:pos,content:node,yAnchor:2});markers.push(overlay);}
      });
      if(pin)pin.setMap(null);pin=data.pin?new kakao.maps.Marker({map,position:new kakao.maps.LatLng(data.pin.lat,data.pin.lng),title:'직접 지정한 위치'}):null;
    };send('ready',{});
  });}catch(e){failure();}};
  document.head.appendChild(sdk);
  </script></body></html>`;
}
