const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Add middleware to parse JSON
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;

  // Input validation
  if (!region || !gameName || !tagLine) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const regionGroup = regionToRegionGroup(region);
  if (!regionGroup) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  try {
    // Get player's PUUID via Riot ID
    const accountRes = await fetch(
      `https://${regionGroup}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
    );
    
    if (!accountRes.ok) {
      throw new Error(`Riot API error: ${accountRes.status}`);
    }
    
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Recent match IDs
    const matchIdsRes = await fetch(
      `https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`
    );
    
    if (!matchIdsRes.ok) {
      throw new Error(`Riot API error: ${matchIdsRes.status}`);
    }
    
    const matchIds = await matchIdsRes.json();

    // Fetch all match details in parallel
    const matchPromises = matchIds.map(matchId => 
      fetch(`https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`)
        .then(res => {
          if (!res.ok) throw new Error(`Riot API error: ${res.status}`);
          return res.json();
        })
    );

    const matches = await Promise.all(matchPromises);

    let wins = 0, losses = 0;
    matches.forEach(match => {
      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (participant?.win) wins++;
      else losses++;
    });

    res.json({
      gameName,
      tagLine,
      recentRecord: {
        wins,
        losses,
        total: wins + losses
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching recent games', details: error.message });
  }
});

function regionToRegionGroup(region) {
  const groups = {
    na1: 'americas',
    br1: 'americas',
    la1: 'americas',
    la2: 'americas',
    euw1: 'europe',
    eun1: 'europe',
    ru: 'europe',
    tr1: 'europe',
    kr: 'asia',
    jp1: 'asia',
    oc1: 'sea',
  };
  return groups[region.toLowerCase()];
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
