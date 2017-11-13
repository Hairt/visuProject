//Encapsulation propre de notre script
(function () {
    /*
     * Calcul de variables générale
     */
    //Url des données
    var urlData = "nat2015b.tsv"
    //Parseur de temps au format année
    var parseTime = d3.timeParse("%Y");
    //Selection des éléments liste de prénoms et svg
    var listeChoixPrenoms = d3.select("#liste-prenoms");
    var svg = d3.select("svg");
    //Calcul des marges et de la taille interne au svg
    var margin = {top: 30, right: 50, bottom: 30, left: 50},
            width = +svg.attr("width") - margin.left - margin.right,
            height = +svg.attr("height") - margin.top - margin.bottom;
    //Creation de la zone de dessin à l'interieur du svg
    var zoneDessin = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    //Création de la zone de dessin pour l'axe des absisses et des ordonnées
    var zoneAxeAbsisses = zoneDessin.append("g")
            .attr("class", "axis axis-x")
            .attr("transform", "translate(0," + height + ")");
    var zoneAxeOrdonnees = zoneDessin.append("g")
            .attr("class", "axis axis-y")
            .attr("transform", "translate(0,0)");
    
    //Création d'une echelle de couleur
    var echelleCouleur = d3.scaleOrdinal(d3.schemeCategory20);

    //déclaration du dataset général
    var dataset = {
        prenoms: [],
        series: []
    };
    //déclaration de l'ensemble des prénom selectionnée
    var prenomsSelectionnes = new Set();

    /*
     * Définitions des fonctions
     */
    //Traiter un datum des données tsv et renvoie sa 
    //Version traitée ou rien si le datum est invalide
    function traiterObjetTsv(d) {
        //Défini le champ annee (Date)
        d.annee = parseTime(d.annais);
        //Si annee invalide, enleve le datum du dataset
        if (d.annee === null)
            return null;
        //Défini sexe (M|F), prenom (String), nombre (number)
        d.sexe = d.sexe === 1 ? 'M' : 'F';
        d.prenom = d.preusuel;
        d.nombre = +d.nombre;
        //Supprime les champs inutilisé
        delete d.preusuel;
        delete d.annais;
        return d;
    }

    //Construit le dataset à partir des données tsv
    function construireDataset(data) {
        //Calcule des series de données par prénoms
        var seriesParPrenom = {};
        data.forEach(d => {
            //Récupère la série du prénom en la créant si inexistante
            var serie = seriesParPrenom[d.prenom] = d.prenom in seriesParPrenom ? seriesParPrenom[d.prenom] : [];
            //Ajoute la donnée à la série
            serie.push(d);
        });
        //Récupère l'ensemble des clé (prénoms) et des valeurs (series)
        dataset.prenoms = Object.keys(seriesParPrenom);
        dataset.series = Object.values(seriesParPrenom);
    }

    //fonction de traitement du changement de choix dans la liste des prénom
    function changementChoix(prenom) {
        //vérifie si l'élément DOM correspondant est selectionné ou pas
        //le contexte this coorespond à l'élement DOM !
        //Ajoute ou retire le prénom du set
        if (this.checked) {
            prenomsSelectionnes.add(prenom);
        } else {
            prenomsSelectionnes.delete(prenom);
        }
        //Met à jour la sélection des prénoms pour mettre en couleur ceux sélectionnés
        listeChoixPrenoms.selectAll("span")
                .style("color", function(d){
                    return prenomsSelectionnes.has(d) ? echelleCouleur(d) : null;
        });
        //Redessine les courbe
        dessinerCourbe();
    }

    //Fonction de création de la liste des prénoms à partir des series completes de données
    function creerListePrenoms() {
        //Selectionne élements de la liste de prénoms et y associe les prenoms (avec un track sur les prénoms eux-mêmes)
        var choixPrenomsUpdated = listeChoixPrenoms.selectAll(".choix-prenom")
                .data(dataset.prenoms, d => d);
        //Supprime les éléments pour les prénoms disparus
        choixPrenomsUpdated.exit().remove();
        //Ajoute un élément de choix pour les nouveaux prénoms
        var nouveauxChoix = choixPrenomsUpdated.enter()
                .append("div")
                .attr("class", "form-check choix-prenom");
        //Ajoute un label et un input à chaque nouveau choix
        var labels = nouveauxChoix.append("label")
                .attr("class", "form-check-label");
        labels.append("input")
                .attr("class", "form-check-input")
                .attr("type", "checkbox")
                .on("change", changementChoix); //ajoute un listener, levé d'un qu'un élement input  est changé  
        labels.append("span");
        //Fusionne la selection des nouveaux choix et des choix déjà existant, 
        var choixPrenoms = nouveauxChoix.merge(choixPrenomsUpdated);
        //(Re)défini la valeur des inputs et le texte du label de chaque choix
        choixPrenoms.selectAll("input")
                .attr("value", d => d);
        choixPrenoms.selectAll("span")
                .text(d => d);
    }

    //Fonction de dessin 
    function dessinerCourbe() {
        //Créer un sous ensemble de séries correspondant aux prenom selectionné
        var series = dataset.series.filter(s => prenomsSelectionnes.has(s[0].prenom));

        //Calcul les date min, max, et nombre max
        var limites = series
                .map(serie => serie.reduce((l, datum) => { //Pour chaque série, calcul les limites
                        if (!l.dateMin || l.dateMin > datum.annee)
                            l.dateMin = datum.annee;
                        if (!l.dateMax || l.dateMax < datum.annee)
                            l.dateMax = datum.annee;
                        if (!l.nombreMax || l.nombreMax < datum.nombre)
                            l.nombreMax = datum.nombre;
                        return l;
                    }, {}))
                .reduce((l, limitesSerie) => { //Pour chaque limites calcul, calcules les limites globales
                    if (!l.dateMin || l.dateMin > limitesSerie.dateMin)
                        l.dateMin = limitesSerie.dateMin;
                    if (!l.dateMax || l.dateMax < limitesSerie.dateMax)
                        l.dateMax = limitesSerie.dateMax;
                    if (!l.nombreMax || l.nombreMax < limitesSerie.nombreMax)
                        l.nombreMax = limitesSerie.nombreMax;
                    return l;
                }, {});

        //Créer les échelles pour les abssices (temporelles), ordonnées (lineaires) 
        var echelleAbscisses = d3.scaleTime()
                .domain([limites.dateMin, limites.dateMax])
                .range([0, width]);

        var echelleOrdonnees = d3.scaleLinear()
                .domain([0, limites.nombreMax])
                .range([height, 0]);
        
        //Création une transition commune pour faire une animation belle et unique
        var tCommune = d3.transition().duration(1000);

        //Repositionne l'axe horizontal des années (avec transition)
        zoneAxeAbsisses.transition(tCommune).call(d3.axisBottom(echelleAbscisses));
        zoneAxeOrdonnees.transition(tCommune).call(d3.axisLeft(echelleOrdonnees));

        //Lie chaque serie aux élément de classe CSS serie avec une clé sur le prénom
        var elementsSeriesUpdated = zoneDessin.selectAll(".serie")
                .data(series, d => d[0].prenom);

        //Supprime les séries retirées 
        elementsSeriesUpdated
                .exit()
                .remove();

        //Ajoute des éléments g de class serie aux nouvelles serie
        //Puis y ajoute un chemin dont 
        var entered = elementsSeriesUpdated.enter()
                .append("g")
                .attr("class", "serie");
        entered
                .append("path")
                .attr("class", "line")
                .style("stroke", function (data) {
                    return echelleCouleur(data[0].prenom);
                })
                .attr("d", d3.line()
                        .x(function (d) {
                            return echelleAbscisses(d.annee);
                        })
                        .y(function (d) {
                            return height/2;
                        }));

        //Modifie données du chemin pour les series nouvelles et mises à jour (avec transition)
        entered.merge(elementsSeriesUpdated).transition(tCommune)
                .selectAll("path")
                .attr("d", d3.line()
                        .x(function (d) {
                            return echelleAbscisses(d.annee);
                        })
                        .y(function (d) {
                            return echelleOrdonnees(d.nombre);
                        }));
    }

    /*
     * Récupération des données au format tsv
     * Traiter chaque objet du tsv, puis calcul les series et les prenom et creer la liste des prénoms
     */
    //Ajout d'un message indiquant le chargement
    d3.select("#loadingMessage").text("Chargement...");
    d3.tsv(urlData, traiterObjetTsv, function (error, data) {
        //Suppression du message de chargement
        d3.select("#loadingMessage").text(null);
        //Levée d'erreur le cas échéant
        if (error)
            throw error;
        //Construit le dataset
        construireDataset(data);
        //Construit la liste des prénoms
        creerListePrenoms();
    });
})();