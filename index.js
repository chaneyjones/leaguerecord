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

app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;
  const MAX_SESSION_GAP_HOURS = 12;

  try {
    // 1. Get PUUID
    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { 
        headers: { 'X-Riot-Token': RIOT_API_KEY },
        timeout: 5000
      }
    );
    
    if (!accountRes.data?.puuid) {
      return res.status(404).send('Player not found');
    }
    const puuid = accountRes.data.puuid;

    // 2. Get match IDs (newest first)
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=100`,
      { 
        headers: { 'X-Riot-Token': RIOT_API_KEY },
        timeout: 5000
      }
    );
    
    const matchIds = matchIdsRes.data || [];
    if (matchIds.length === 0) {
      return res.send(`${gameName}#${tagLine} has no recent matches`);
    }

    // 3. Get match details in parallel
    const matchDetails = await Promise.all(
      matchIds.map(matchId =>
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          { 
            headers: { 'X-Riot-Token': RIOT_API_KEY },
            timeout: 5000
          }
        ).catch(e => null) // Skip failed requests
      )
    );

    // 4. Process valid matches only
    const validMatches = matchDetails
      .filter(match => match?.data?.info)
      .map(match => ({
        timestamp: match.data.info.gameCreation,
        win: match.data.info.participants.find(p => p.puuid === puuid)?.win
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first

    if (validMatches.length === 0) {
      return res.send('No valid match data found');
    }

    // 5. Detect sessions (working backwards from newest)
    const sessions = [];
    let currentSession = [validMatches[0]]; // Start with newest match

    for (let i = 1; i < validMatches.length; i++) {
      const timeDiff = (currentSession[0].timestamp - validMatches[i].timestamp) / (1000 * 60 * 60);
      
      if (timeDiff < MAX_SESSION_GAP_HOURS) {
        currentSession.unshift(validMatches[i]); // Add to beginning (maintain order)
      } else {
        sessions.push(currentSession);
        currentSession = [validMatches[i]];
      }
    }
    sessions.push(currentSession); // Add the last session

    // 6. Get the most recent session (first in array)
    const latestSession = sessions[0] || [];
    const wins = latestSession.filter(m => m.win).length;
    const losses = latestSession.filter(m => !m.win).length;

    // 7. Format response
    res.send(`${gameName} 's recent record: ${wins} wins, ${losses} losses`);

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    res.status(500).send('Error detecting gaming sessions');
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
