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

  try {
    
    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const puuid = accountRes.data.puuid;

 
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const matchIds = matchIdsRes.data;

    let wins = 0, losses = 0;
    const matchDetails = await Promise.all(
      matchIds.map(matchId =>
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        )
      )
    );

    matchDetails.forEach(match => {
      const participant = match.data.info.participants.find(p => p.puuid === puuid);
      if (participant?.win) wins++;
      else losses++;
    });

    res.send(`${gameName}#${tagLine}'s recent record: ${wins} wins, ${losses} losses`);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).send('Error fetching recent games');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
