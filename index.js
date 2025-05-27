const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

app.get('/recentrecord/:region/:summonerName', async (req, res) => {
  const { region, summonerName } = req.params;

  try {
    // Fetch summoner info
    const summonerRes = await fetch(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}?api_key=${RIOT_API_KEY}`
    );
    const summonerData = await summonerRes.json();

    // Fetch recent match IDs
    const puuid = summonerData.puuid;
    const matchIdsRes = await fetch(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`
    );
    const matchIds = await matchIdsRes.json();

    let wins = 0;
    let losses = 0;

    // Check match results
    for (const matchId of matchIds) {
      const matchRes = await fetch(
        `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
      );
      const matchData = await matchRes.json();

      const participant = matchData.info.participants.find(p => p.puuid === puuid);
      if (participant.win) wins++;
      else losses++;
    }

    res.send(`${summonerName}'s recent 10 games: W:${wins} / L:${losses}`);
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