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
    // Fetch TAGS instead of RELEASES because Github /releases endpoint has heavy cache delays for automated releases
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=100`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Moviedeo-App'
      }
    });

    if (!response.ok) {
      throw new Error(`Github API Error: ${response.status}`);
    }

    const tags = await response.json();

    let androidTag = null;
    let tvTag = null;
    let iosTag = null;

    // Find latest tag for each platform (Tags are returned newest first by Github)
    for (const tagObj of tags) {
      const tag = tagObj.name || "";
      if (tag.startsWith("android-v") && !androidTag) {
        androidTag = tag;
      } else if (tag.startsWith("tv-v") && !tvTag) {
        tvTag = tag;
      } else if (tag.startsWith("ios-v") && !iosTag) {
        iosTag = tag;
      }

      if (androidTag && tvTag && iosTag) break;
    }

    const data = {
      android: { version: null, url: null },
      tv: { version: null, url: null },
      ios: { version: null, url: null }
    };

    // Helper to fetch release details by tag name
    const fetchReleaseByTag = async (tagName, platform, ext) => {
      if (!tagName) return;
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tagName}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Moviedeo-App'
          }
        });
        if (res.ok) {
          const release = await res.json();
          // Skip drafts or prereleases if somehow a tag was created for them
          if (!release.draft && !release.prerelease) {
            data[platform].version = tagName.replace(`${platform}-v`, "");
            const asset = release.assets.find(a => a.name.endsWith(ext));
            if (asset) {
              data[platform].url = asset.browser_download_url;
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching release for tag ${tagName}:`, e);
      }
    };

    // Fetch releases for the found tags in parallel
    await Promise.all([
      fetchReleaseByTag(androidTag, 'android', '.apk'),
      fetchReleaseByTag(tvTag, 'tv', '.apk'),
      fetchReleaseByTag(iosTag, 'ios', '.ipa')
    ]);

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching releases:", error);
    res.status(500).json({ error: error.message });
  }
}
