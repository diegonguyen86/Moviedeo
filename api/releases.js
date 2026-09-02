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

    const parseVersion = (tag, prefix) => {
      const v = tag.replace(prefix, '').replace(/^v/, '');
      return v.split('.').map(n => parseInt(n, 10) || 0);
    };

    const compareTagVersions = (a, b, prefix) => {
      const aParts = parseVersion(a, prefix);
      const bParts = parseVersion(b, prefix);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const pA = aParts[i] || 0;
        const pB = bParts[i] || 0;
        if (pA !== pB) return pB - pA; // Descending order
      }
      return 0;
    };

    const androidTags = tags.filter(t => (t.name || '').startsWith('android-v')).map(t => t.name).sort((a, b) => compareTagVersions(a, b, 'android-v'));
    const tvTags = tags.filter(t => (t.name || '').startsWith('tv-v')).map(t => t.name).sort((a, b) => compareTagVersions(a, b, 'tv-v'));
    const iosTags = tags.filter(t => (t.name || '').startsWith('ios-v')).map(t => t.name).sort((a, b) => compareTagVersions(a, b, 'ios-v'));

    const androidTag = androidTags[0] || null;
    const tvTag = tvTags[0] || null;
    const iosTag = iosTags[0] || null;

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
