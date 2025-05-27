const express = require('express');
const axios = require('axios');
const path = require('path');

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

// Riot API verification
app.get('/recentrecord/:region/:username/:tagline/riot.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'riot.txt'));
});

// Main endpoint
app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;
  const MAX_SESSION_GAP_HOURS = 8; // <-- Edit this to change the time gap before it is considered a new session

  try {
    // 1. Get player's PUUID and summoner data
    const [accountRes, summonerRes] = await Promise.all([
   console.log('Riot API key starts with:', RIOT_API_KEY.slice(0, 10));

const [accountRes, summonerRes] = await Promise.all([
  axios.get(
    `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
  ),
  axios.get(
    `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(gameName)}`,
    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
  )
]);

    const puuid = accountRes.data.puuid;
    const summonerId = summonerRes.data.id;

    // 2. Get initial LP
    const rankedBeforeRes = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const soloQueueBefore = rankedBeforeRes.data.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
    const startLP = soloQueueBefore?.leaguePoints ?? null;

    // 3. Get recent matches
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=15`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const matchIds = matchIdsRes.data;

    // 4. Process matches
   const matchDetails = await Promise.all(
  matchIds.map(matchId => 
    axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    ).catch(e => null)
  )
);

    const validMatches = matchDetails
      .filter(match => match?.data?.info)
      .map(match => ({
        timestamp: match.data.info.gameCreation,
        win: match.data.info.participants.find(p => p.puuid === puuid)?.win
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    // 5. Detect session
    let latestSession = [];
    if (validMatches.length > 0) {
      latestSession = [validMatches[0]];
      
      for (let i = 1; i < validMatches.length; i++) {
        const timeDiffHours = (validMatches[i-1].timestamp - validMatches[i].timestamp) / (1000 * 60 * 60);
        if (timeDiffHours < MAX_SESSION_GAP_HOURS) {
          latestSession.push(validMatches[i]);
        } else {
          break;
        }
      }
    }

    // 6. Calculate results
    const wins = latestSession.filter(m => m.win).length;
    const losses = latestSession.filter(m => !m.win).length;

    // 7. Get updated LP (with retry in case of delay)
    let endLP = null;
    try {
      const rankedAfterRes = await axios.get(
        `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
        { headers: { 'X-Riot-Token': RIOT_API_KEY } }
      );
      const soloQueueAfter = rankedAfterRes.data.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
      endLP = soloQueueAfter?.leaguePoints ?? null;
    } catch (e) {
      console.log('LP update check failed, using original LP');
    }

    // 8. Format response
    let lpChangeText = '';
    if (startLP !== null && endLP !== null) {
      const lpDiff = endLP - startLP;
      lpChangeText = ` (${lpDiff >= 0 ? '+' : ''}${lpDiff} LP)`;
    }

    res.send(`${gameName}'s recent record: ${wins} wins, ${losses} losses${lpChangeText}`);
  
} catch (error) {
  const status = error.response?.status;
  const data = error.response?.data;
  console.error('Error:', status, data || error.message);
  res.status(500).send(`Error: ${status} - ${JSON.stringify(data || error.message)}`);
}
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
