export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Cache response globally on Vercel CDN for 5 minutes to avoid Github Rate Limits
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  try {
    const GITHUB_REPO = 'diegonguyen86/Moviedeo';
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Moviedeo-App'
      }
    });

    if (!response.ok) {
      throw new Error(`Github API Error: ${response.status}`);
    }

    const releases = await response.json();

    const data = {
      android: { version: null, url: null },
      tv: { version: null, url: null },
      ios: { version: null, url: null }
    };

    // Find latest for each platform
    for (const release of releases) {
      if (release.draft || release.prerelease) continue;

      const tag = release.tag_name || ""; 

      if (tag.startsWith("android-v") && !data.android.version) {
        data.android.version = tag.replace("android-v", "");
        const apkAsset = release.assets.find(a => a.name.endsWith(".apk"));
        if (apkAsset) {
          data.android.url = apkAsset.browser_download_url;
        }
      } 
      else if (tag.startsWith("tv-v") && !data.tv.version) {
        data.tv.version = tag.replace("tv-v", "");
        const apkAsset = release.assets.find(a => a.name.endsWith(".apk"));
        if (apkAsset) {
          data.tv.url = apkAsset.browser_download_url;
        }
      }
      else if (tag.startsWith("ios-v") && !data.ios.version) {
        data.ios.version = tag.replace("ios-v", "");
        const ipaAsset = release.assets.find(a => a.name.endsWith(".ipa"));
        if (ipaAsset) {
          data.ios.url = ipaAsset.browser_download_url;
        }
      }

      if (data.android.version && data.tv.version && data.ios.version) {
        break;
      }
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching releases:", error);
    res.status(500).json({ error: error.message });
  }
}
