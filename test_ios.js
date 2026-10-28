async function testIosClient() {
  const vid = 'K_iaQPLdmJU';
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/19.29.1 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '19.29.1'
      },
      body: JSON.stringify({
        videoId: vid,
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.29.1',
            deviceMake: 'Apple',
            deviceModel: 'iPhone14,3',
            hl: 'it',
            gl: 'IT'
          }
        }
      })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('PlayabilityStatus:', data.playabilityStatus?.status);
    const formats = data.streamingData?.adaptiveFormats || [];
    const audios = formats.filter(f => (f.mimeType || '').includes('audio'));
    console.log('Found audio formats count:', audios.length);
    for (const a of audios) {
      console.log('itag:', a.itag, 'mime:', a.mimeType, 'has direct url?', !!a.url);
      if (a.url) {
        console.log('DIRECT URL FOUND:', a.url.substring(0, 100));
        return a.url;
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
testIosClient();
