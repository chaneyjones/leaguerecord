app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;

  try {
    // Fetch player PUUID via Riot ID
    const accountRes = await fetch(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
    );
    const accountData = await accountRes.json();

    const puuid = accountData.puuid;

    // Fetch recent match IDs
    const matchIdsRes = await fetch(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`
    );
    const matchIds = await matchIdsRes.json();

    let wins = 0, losses = 0;

    // Fetch match details
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
