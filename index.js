const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;


app.use(express.json());

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
  return groups[region.toLowerCase()] || 'americas';
}
const path = require('path');

app.get('/recentrecord/:region/:username/:tagline/riot.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'riot.txt'));
});

app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;
  const MAX_SESSION_GAP_HOURS = 12;

  try {
    // 1. Get player's PUUID
    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
    );
    const puuid = accountRes.data.puuid;

    // 2. Get recent match IDs
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`
    );
    const matchIds = matchIdsRes.data;

    // 3. Fetch match details and process timestamps
    const matchDetails = await Promise.all(
      matchIds.map(matchId => 
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
        ).catch(e => null)
      )
    );

    // 4. Filter and sort matches NEWEST FIRST
    const validMatches = matchDetails
      .filter(match => match?.data?.info)
      .map(match => ({
        timestamp: match.data.info.gameCreation,
        win: match.data.info.participants.find(p => p.puuid === puuid)?.win
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // NEWEST FIRST

    // 5. Detect sessions working FORWARD from newest
    let latestSession = [];
    if (validMatches.length > 0) {
      latestSession = [validMatches[0]]; // Start with newest match
      
      for (let i = 1; i < validMatches.length; i++) {
        const timeDiffHours = (validMatches[i-1].timestamp - validMatches[i].timestamp) / (1000 * 60 * 60);
        if (timeDiffHours < MAX_SESSION_GAP_HOURS) {
          latestSession.push(validMatches[i]);
        } else {
          break; // Session gap detected
        }
      }
    }

    // 6. Calculate wins/losses
    const wins = latestSession.filter(m => m.win).length;
    const losses = latestSession.filter(m => !m.win).length;

    res.send(`${gameName} 's recent record: ${wins} wins, ${losses} losses`);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error detecting gaming sessions');
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
