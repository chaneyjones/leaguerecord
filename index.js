const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;

  try {
    // Get player's PUUID via Riot ID
    const accountRes = await fetch(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
    );
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Recent match IDs
    const matchIdsRes = await fetch(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`
    );
    const matchIds = await matchIdsRes.json();

    let wins = 0, losses = 0;

    for (const matchId of matchIds) {
      const matchRes = await fetch(
        `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
      );
      const matchData = await matchRes.json();
      const participant = matchData.info.participants.find(p => p.puuid === puuid);
      if (participant.win) wins++;
      else losses++;
    }

    res.send(`${gameName}#${tagLine}'s recent 10 games: W:${wins} / L:${losses}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recent games.');
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
  return groups[region];
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
