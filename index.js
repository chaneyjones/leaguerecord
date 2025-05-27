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
  const MAX_SESSION_GAP_HOURS = 12; // Consider games <12h apart part of the same session

  try {

    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const puuid = accountRes.data.puuid;


    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=100`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const matchIds = matchIdsRes.data;


    const matchDetails = await Promise.all(
      matchIds.map(matchId =>
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        )
      )
    );

    
    const matchesWithTimestamps = matchDetails
      .map(match => ({
        timestamp: match.data.info.gameCreation, // Unix timestamp in ms
        win: match.data.info.participants.find(p => p.puuid === puuid)?.win
      }))
      .sort((a, b) => a.timestamp - b.timestamp); // Oldest first

   
    const sessions = [];
    let currentSession = [];

    for (let i = 0; i < matchesWithTimestamps.length; i++) {
      if (i === 0) {
        currentSession.push(matchesWithTimestamps[i]);
      } else {
        const prevTime = matchesWithTimestamps[i - 1].timestamp;
        const currTime = matchesWithTimestamps[i].timestamp;
        const hoursBetweenGames = (currTime - prevTime) / (1000 * 60 * 60);

        if (hoursBetweenGames < MAX_SESSION_GAP_HOURS) {
          currentSession.push(matchesWithTimestamps[i]);
        } else {
          sessions.push(currentSession);
          currentSession = [matchesWithTimestamps[i]];
        }
      }
    }
    if (currentSession.length > 0) sessions.push(currentSession);

 
    const latestSession = sessions[sessions.length - 1] || [];
    const wins = latestSession.filter(m => m.win).length;
    const losses = latestSession.filter(m => !m.win).length;

 
    res.send(`
      🎮 ${gameName}#${tagLine}'s latest gaming session:
      ✅ Wins: ${wins} | ❌ Losses: ${losses}
      📅 ${latestSession.length} games played within ${MAX_SESSION_GAP_HOURS}h of each other
    `);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).send('Error detecting gaming sessions');
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {  
  console.log(`Server running on port ${PORT}`);

});
