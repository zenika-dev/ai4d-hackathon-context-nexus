# Checklist · publier son contrat v1 (avant G2)

- [ ] `version: 1.0.0`, `status: active`, `owner` nommé, `last-validated` du jour
- [ ] `consumes` épinglé sur la version **actuelle** de chaque contrat d'une autre squad lu (`context-assemble --check` passe)
- [ ] `consumers` à jour
- [ ] Chaque champ échangé a un type, une **unité** et un exemple (API-02)
- [ ] Les écarts trouvés avec les autres squads sont réglés **avec elles**, ou notés comme question ouverte
- [ ] Un mock est disponible pour les autres squads (API-05)
- [ ] La section « Ce que la v1 doit encore préciser » du v0 est traitée ou explicitement reportée
