const express = require('express');
const axios = require('axios'); 

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;

  try {
    // Get PUUID
    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } } 
    );
    const puuid = accountRes.data.puuid;

    // Get recent match IDs
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const matchIds = matchIdsRes.data;

    // Get match details in parallel
    const matchDetails = await Promise.all(
      matchIds.map(matchId => 
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        )
      )
    );

    let wins = 0, losses = 0;
    matchDetails.forEach(match => {
      const participant = match.data.info.participants.find(p => p.puuid === puuid);
      if (participant?.win) wins++;
      else losses++;
    });

    res.json({
      gameName,
      tagLine,
      recentRecord: { wins, losses, total: wins + losses }
    });
  } catch (error) {
    console.error('Riot API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch match data', details: error.message });
  }
});

function regionToRegionGroup(region) {
  const groups = {
    na1: 'americas',
    br1: 'americas',
    euw1: 'europe',
    eun1: 'europe',
    kr: 'asia',
    jp1: 'asia',
   
  };
  return groups[region.toLowerCase()] || 'americas'; 
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
