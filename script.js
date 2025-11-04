// État global de l'application
const etatApplication = {
    clients: [],
    ventes: [],
    stock: {
        'Produit A': 50,
        'Produit B': 30,
        'Produit C': 20
    },
    factures: [],
    messagesESB: []
};

// Méthode ESB - Routeur Central
class ESB {
    constructor() {
        this.middlewares = [];
        this.historiqueMessages = [];
    }

    // Envoyer un message via l'ESB
    async envoyerMessage(destinataire, action, donnees) {
        const message = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            source: 'ESB',
            destinataire,
            action,
            donnees,
            statut: 'en_cours'
        };

        this.ajouterLogMessage(`ESB → Routage vers ${destinataire}: ${action}`, 'esb');
        this.historiqueMessages.push(message);
        
        // Simulation traitement ESB
        await this.simulerTraitementESB();
        
        // Appel du service destinataire
        const reponse = await this.appelerService(destinataire, action, donnees);
        
        message.statut = reponse.success ? 'termine' : 'erreur';
        message.reponse = reponse;
        
        this.ajouterLogMessage(`ESB ← Réponse de ${destinataire}: ${reponse.message || action}`, 'service');
        
        return reponse;
    }

    // Appeler un service spécifique
    async appelerService(service, action, donnees) {
        switch (service) {
            case 'gestion':
                return await ServiceGestion.traiterRequete(action, donnees);
            case 'ventes':
                return await ServiceVentes.traiterRequete(action, donnees);
            case 'stock':
                return await ServiceStock.traiterRequete(action, donnees);
            case 'facturation':
                return await ServiceFacturation.traiterRequete(action, donnees);
            default:
                return { success: false, error: 'Service inconnu' };
        }
    }

    // Simuler le traitement ESB
    async simulerTraitementESB() {
        return new Promise(resolve => {
            setTimeout(resolve, 300 + Math.random() * 700);
        });
    }

    // Ajouter un log de message
    ajouterLogMessage(message, type = 'esb') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            message: `[${timestamp}] ${message}`,
            type: type,
            timestamp: timestamp
        };
        
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${type}`;
        logElement.textContent = logEntry.message;
        
        const logContainer = document.getElementById('message-log');
        logContainer.appendChild(logElement);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Sauvegarder dans l'historique
        this.historiqueMessages.push(logEntry);
    }

    // Obtenir l'historique des messages
    getHistoriqueMessages() {
        return this.historiqueMessages;
    }
}

// Services Métier - Implémentations
class ServiceGestion {
    static async traiterRequete(action, donnees) {
        switch (action) {
            case 'creerClient':
                const nouveauClient = {
                    id: 'CLI' + Date.now(),
                    nom: donnees.nom,
                    email: donnees.email,
                    telephone: donnees.telephone || 'Non renseigné',
                    adresse: donnees.adresse || 'Non renseignée',
                    dateCreation: new Date().toLocaleString()
                };
                etatApplication.clients.push(nouveauClient);
                this.mettreAJourAffichage('gestion', 
                    `Client créé: ${nouveauClient.nom} (${nouveauClient.email})`
                );
                return { 
                    success: true, 
                    client: nouveauClient, 
                    message: 'Client créé avec succès' 
                };

            case 'listerClients':
                const listeClients = etatApplication.clients.map(c => 
                    `${c.nom} (${c.email})`
                ).join('\n') || 'Aucun client enregistré';
                this.mettreAJourAffichage('gestion', 
                    `Liste des clients:\n${listeClients}`
                );
                return { success: true, clients: etatApplication.clients, message: 'Liste des clients récupérée' };

            default:
                return { success: false, error: 'Action non supportée' };
        }
    }

    static mettreAJourAffichage(service, contenu) {
        const element = document.getElementById(`data-${service}`);
        if (element) {
            element.textContent = contenu;
        }
    }
}

class ServiceVentes {
    static async traiterRequete(action, donnees) {
        switch (action) {
            case 'creerVente':
                // Vérifier d'abord le stock via ESB
                const verificationStock = await esb.envoyerMessage('stock', 'verifierStock', {
                    produit: donnees.produit || 'Produit A',
                    quantite: donnees.quantite || 1
                });

                if (!verificationStock.success || !verificationStock.stockSuffisant) {
                    this.mettreAJourAffichage('ventes', 'Stock insuffisant pour créer la vente');
                    return { success: false, error: 'Stock insuffisant' };
                }

                const nouvelleVente = {
                    id: 'VENTE' + Date.now(),
                    clientId: donnees.clientId || etatApplication.clients[0]?.id,
                    produit: donnees.produit || 'Produit A',
                    quantite: donnees.quantite || 1,
                    date: new Date().toLocaleString(),
                    statut: 'en_attente_paiement'
                };
                etatApplication.ventes.push(nouvelleVente);
                this.mettreAJourAffichage('ventes', 
                    `Vente créée: ${nouvelleVente.produit} x${nouvelleVente.quantite}`
                );
                return { success: true, vente: nouvelleVente, message: 'Vente créée avec succès' };

            case 'historiqueVentes':
                const historique = etatApplication.ventes.map(v => 
                    `${v.produit} x${v.quantite} (${v.date})`
                ).join('\n') || 'Aucune vente enregistrée';
                this.mettreAJourAffichage('ventes', 
                    `Historique des ventes:\n${historique}`
                );
                return { success: true, ventes: etatApplication.ventes, message: 'Historique récupéré' };

            default:
                return { success: false, error: 'Action non supportée' };
        }
    }

    static mettreAJourAffichage(service, contenu) {
        const element = document.getElementById(`data-${service}`);
        if (element) {
            element.textContent = contenu;
        }
    }
}

class ServiceStock {
    static async traiterRequete(action, donnees) {
        switch (action) {
            case 'verifierStock':
                const produit = donnees.produit;
                const quantiteDemandee = donnees.quantite || 1;
                const stockActuel = etatApplication.stock[produit] || 0;
                const stockSuffisant = stockActuel >= quantiteDemandee;
                
                this.mettreAJourAffichage('stock', 
                    `Stock ${produit}: ${stockActuel} unités\nDemande: ${quantiteDemandee}\nSuffisant: ${stockSuffisant ? 'OUI' : 'NON'}`
                );
                return { 
                    success: true, 
                    stockSuffisant, 
                    stockActuel, 
                    message: `Vérification stock ${produit}: ${stockSuffisant ? 'OK' : 'INSUFFISANT'}` 
                };

            case 'majStock':
                const produitMaj = donnees.produit;
                const nouvelleQuantite = donnees.quantite;
                if (produitMaj && nouvelleQuantite !== undefined) {
                    etatApplication.stock[produitMaj] = nouvelleQuantite;
                    this.mettreAJourAffichage('stock', 
                        `Stock ${produitMaj} mis à jour: ${nouvelleQuantite} unités`
                    );
                    return { success: true, message: `Stock ${produitMaj} mis à jour` };
                }
                return { success: false, error: 'Données de mise à jour invalides' };

            default:
                return { success: false, error: 'Action non supportée' };
        }
    }

    static mettreAJourAffichage(service, contenu) {
        const element = document.getElementById(`data-${service}`);
        if (element) {
            element.textContent = contenu;
        }
    }
}

class ServiceFacturation {
    static async traiterRequete(action, donnees) {
        switch (action) {
            case 'genererFacture':
                const nouvelleFacture = {
                    id: 'FACT' + Date.now(),
                    venteId: donnees.venteId,
                    montant: donnees.montant || 100,
                    date: new Date().toLocaleString(),
                    statut: 'generée'
                };
                etatApplication.factures.push(nouvelleFacture);
                this.mettreAJourAffichage('facturation', 
                    `Facture générée: ${nouvelleFacture.montant}€\nPour vente: ${nouvelleFacture.venteId}`
                );
                return { success: true, facture: nouvelleFacture, message: 'Facture générée avec succès' };

            case 'facturesEnAttente':
                const facturesAttente = etatApplication.factures.filter(f => f.statut === 'generée');
                const listeFactures = facturesAttente.map(f => 
                    `Facture ${f.id}: ${f.montant}€`
                ).join('\n') || 'Aucune facture en attente';
                this.mettreAJourAffichage('facturation', 
                    `Factures en attente:\n${listeFactures}`
                );
                return { success: true, factures: facturesAttente, message: 'Factures en attente récupérées' };

            default:
                return { success: false, error: 'Action non supportée' };
        }
    }

    static mettreAJourAffichage(service, contenu) {
        const element = document.getElementById(`data-${service}`);
        if (element) {
            element.textContent = contenu;
        }
    }
}

// Instance ESB globale
const esb = new ESB();

// =============================================
// GESTION DU FORMULAIRE CLIENT
// =============================================

let formulaireOuvert = false;

function toggleFormulaireClient() {
    const overlay = document.getElementById('formulaire-overlay');
    const formulaire = document.getElementById('formulaire-client');
    
    if (!formulaireOuvert) {
        overlay.style.display = 'block';
        formulaire.style.display = 'block';
        
        setTimeout(() => {
            overlay.classList.add('active');
            formulaire.classList.add('active');
        }, 10);
        
        formulaireOuvert = true;
    } else {
        overlay.classList.remove('active');
        formulaire.classList.remove('active');
        
        setTimeout(() => {
            overlay.style.display = 'none';
            formulaire.style.display = 'none';
        }, 300);
        
        formulaireOuvert = false;
    }
}

async function soumettreFormulaireClient(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const donneesClient = {
        nom: formData.get('nom'),
        email: formData.get('email'),
        telephone: formData.get('telephone'),
        adresse: formData.get('adresse')
    };
    
    if (!donneesClient.nom || !donneesClient.email) {
        alert('Le nom et l\'email sont obligatoires');
        return;
    }
    
    // Reset form and close modal
    event.target.reset();
    toggleFormulaireClient();
    
    // Process the client creation
    await esb.envoyerMessage('gestion', 'creerClient', donneesClient);
}

function annulerFormulaire() {
    const formulaire = document.getElementById('formulaire-client');
    const overlay = document.getElementById('formulaire-overlay');
    
    // Reset the form
    formulaire.querySelector('form').reset();
    
    // Close the modal
    overlay.classList.remove('active');
    formulaire.classList.remove('active');
    
    setTimeout(() => {
        overlay.style.display = 'none';
        formulaire.style.display = 'none';
    }, 300);
    
    formulaireOuvert = false;
}

// =============================================
// FONCTIONS PRINCIPALES
// =============================================

async function appelerService(service, action) {
    const donnees = genererDonneesTest(service, action);
    await esb.envoyerMessage(service, action, donnees);
}

function genererDonneesTest(service, action) {
    const donneesTest = {
        gestion: {
            creerClient: { nom: `Client Test ${Date.now()}`, email: `test${Date.now()}@example.com` },
            listerClients: {}
        },
        ventes: {
            creerVente: { produit: 'Produit A', quantite: 2 },
            historiqueVentes: {}
        },
        stock: {
            verifierStock: { produit: 'Produit A', quantite: 1 },
            majStock: { produit: 'Produit A', quantite: 40 }
        },
        facturation: {
            genererFacture: { venteId: 'VENTE' + Date.now(), montant: 150 },
            facturesEnAttente: {}
        }
    };
    
    return donneesTest[service]?.[action] || {};
}

async function executerProcessusComplet() {
    const logsProcessus = document.getElementById('process-logs');
    logsProcessus.innerHTML = '<div>Démarrage processus vente complet...</div>';

    try {
        logsProcessus.innerHTML += '<div>1. Création du client...</div>';
        const client = await esb.envoyerMessage('gestion', 'creerClient', {
            nom: 'Pierre Martin',
            email: 'pierre.martin@example.com'
        });

        if (!client.success) throw new Error('Échec création client');

        logsProcessus.innerHTML += '<div>2. Création de la vente...</div>';
        const vente = await esb.envoyerMessage('ventes', 'creerVente', {
            clientId: client.client.id,
            produit: 'Produit A',
            quantite: 3
        });

        if (!vente.success) throw new Error('Échec création vente');

        logsProcessus.innerHTML += '<div>3. Génération de la facture...</div>';
        const facture = await esb.envoyerMessage('facturation', 'genererFacture', {
            venteId: vente.vente.id,
            montant: 300
        });

        if (!facture.success) throw new Error('Échec génération facture');

        logsProcessus.innerHTML += '<div style="color: green; font-weight: bold;">Processus terminé avec succès!</div>';

    } catch (error) {
        logsProcessus.innerHTML += `<div style="color: red; font-weight: bold;">Erreur: ${error.message}</div>`;
    }
}

function reinitialiserSysteme() {
    etatApplication.clients = [];
    etatApplication.ventes = [];
    etatApplication.factures = [];
    etatApplication.stock = {
        'Produit A': 50,
        'Produit B': 30,
        'Produit C': 20
    };

    document.querySelectorAll('.service-data').forEach(el => {
        if (el.id === 'data-stock') {
            el.textContent = 'Produit A: 50, Produit B: 30, Produit C: 20';
        } else {
            el.textContent = el.id === 'data-gestion' ? 'Aucune action effectuée' : 
                           el.id === 'data-ventes' ? 'Aucune vente enregistrée' :
                           'Aucune facture générée';
        }
    });
    
    document.getElementById('process-logs').innerHTML = 'Aucun processus exécuté...';
    document.getElementById('message-log').innerHTML = 
        '<div class="log-entry">Système réinitialisé - ESB prêt à router les messages</div>';

    esb.ajouterLogMessage('Système réinitialisé avec succès', 'esb');
}

// =============================================
// FONCTIONNALITÉS PDF
// =============================================

async function exporterServicePDF(serviceName) {
    if (typeof window.jspdf === 'undefined') {
        alert('Veuillez charger la bibliothèque jsPDF d\'abord');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(`Rapport ${getServiceName(serviceName)}`, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date d'export: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    
    const donnees = getDonneesService(serviceName);
    let yPosition = 50;
    
    donnees.forEach((ligne, index) => {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }
        
        if (ligne.includes('•')) {
            doc.setFontSize(10);
            doc.text(ligne, 25, yPosition);
        } else {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(ligne, 20, yPosition);
            doc.setFont(undefined, 'normal');
        }
        yPosition += 8;
    });
    
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Généré par Application SOA avec ESB', 105, 285, { align: 'center' });
    
    doc.save(`rapport_${serviceName}_${new Date().getTime()}.pdf`);
}

function exporterLogsPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('Veuillez charger la bibliothèque jsPDF d\'abord');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Rapport Logs ESB", 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Généré le: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 32, 190, 32);
    
    const logs = document.getElementById('message-log').children;
    let yPosition = 45;
    let pageNumber = 1;
    
    Array.from(logs).forEach((log, index) => {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
            pageNumber++;
        }
        
        if (log.className.includes('error')) {
            doc.setTextColor(220, 50, 50);
        } else if (log.className.includes('service')) {
            doc.setTextColor(30, 130, 70);
        } else if (log.className.includes('esb')) {
            doc.setTextColor(30, 100, 200);
        } else {
            doc.setTextColor(40, 40, 40);
        }
        
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(log.textContent, 170);
        doc.text(lines, 20, yPosition);
        yPosition += (lines.length * 5) + 2;
    });
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${pageNumber}`, 105, 285, { align: 'center' });
    
    doc.save(`logs_esb_${new Date().getTime()}.pdf`);
}

function exporterProcessusPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('Veuillez charger la bibliothèque jsPDF d\'abord');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Rapport Processus Complet", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Processus exécuté le: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Résumé du Système:", 20, 50);
    
    doc.setFontSize(10);
    let yPosition = 65;
    
    const resume = [
        `• Clients: ${etatApplication.clients.length}`,
        `• Ventes: ${etatApplication.ventes.length}`,
        `• Factures: ${etatApplication.factures.length}`,
        `• Produits en stock: ${Object.keys(etatApplication.stock).length}`
    ];
    
    resume.forEach(ligne => {
        doc.text(ligne, 25, yPosition);
        yPosition += 8;
    });
    
    yPosition += 10;
    doc.setFontSize(14);
    doc.text("Dernières Activités:", 20, yPosition);
    yPosition += 12;
    
    doc.setFontSize(8);
    const derniersLogs = Array.from(document.getElementById('message-log').children)
        .slice(-10)
        .reverse();
    
    derniersLogs.forEach(log => {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }
        doc.text(log.textContent, 20, yPosition, { maxWidth: 170 });
        yPosition += 12;
    });
    
    doc.save(`processus_complet_${new Date().getTime()}.pdf`);
}

function getServiceName(serviceCode) {
    const noms = {
        'gestion': 'Service Gestion Clients',
        'ventes': 'Service Gestion Ventes', 
        'stock': 'Service Gestion Stock',
        'facturation': 'Service Facturation'
    };
    return noms[serviceCode] || 'Service Inconnu';
}

function getDonneesService(serviceName) {
    const donnees = [];
    
    switch(serviceName) {
        case 'gestion':
            donnees.push(`Total Clients: ${etatApplication.clients.length}`);
            donnees.push('');
            donnees.push('Liste des Clients:');
            etatApplication.clients.forEach(client => {
                donnees.push(`• ${client.nom} (${client.id})`);
                donnees.push(`  Email: ${client.email}`);
                donnees.push(`  Téléphone: ${client.telephone}`);
                donnees.push(`  Adresse: ${client.adresse}`);
                donnees.push(`  Créé le: ${client.dateCreation}`);
                donnees.push('');
            });
            if (etatApplication.clients.length === 0) {
                donnees.push('Aucun client enregistré');
            }
            break;
            
        case 'ventes':
            donnees.push(`Total Ventes: ${etatApplication.ventes.length}`);
            donnees.push('');
            donnees.push('Historique des Ventes:');
            etatApplication.ventes.forEach(vente => {
                donnees.push(`• ${vente.produit} x${vente.quantite}`);
                donnees.push(`  Client: ${vente.clientId}`);
                donnees.push(`  Date: ${vente.date}`);
                donnees.push(`  Statut: ${vente.statut}`);
                donnees.push('');
            });
            if (etatApplication.ventes.length === 0) {
                donnees.push('Aucune vente enregistrée');
            }
            break;
            
        case 'stock':
            donnees.push("État du Stock Actuel:");
            donnees.push('');
            for (const [produit, quantite] of Object.entries(etatApplication.stock)) {
                donnees.push(`• ${produit}: ${quantite} unités`);
            }
            break;
            
        case 'facturation':
            donnees.push(`Total Factures: ${etatApplication.factures.length}`);
            const facturesEnAttente = etatApplication.factures.filter(f => f.statut === 'generée');
            donnees.push(`Factures en attente: ${facturesEnAttente.length}`);
            donnees.push('');
            donnees.push('Détails des Factures:');
            etatApplication.factures.forEach(facture => {
                donnees.push(`• Facture ${facture.id}`);
                donnees.push(`  Montant: ${facture.montant}€`);
                donnees.push(`  Vente: ${facture.venteId}`);
                donnees.push(`  Date: ${facture.date}`);
                donnees.push(`  Statut: ${facture.statut}`);
                donnees.push('');
            });
            break;
    }
    
    return donnees;
}

// =============================================
// INITIALISATION
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    // Configuration des événements du formulaire
    const overlay = document.getElementById('formulaire-overlay');
    const formulaire = document.getElementById('formulaire-client');
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            annulerFormulaire();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && formulaireOuvert) {
            annulerFormulaire();
        }
    });
    
    // Initialisation du système
    esb.ajouterLogMessage('Application SOA avec ESB initialisée', 'esb');
    esb.ajouterLogMessage('Système prêt - Tous les services opérationnels', 'success');
    
    if (typeof window.jspdf !== 'undefined') {
        esb.ajouterLogMessage('Fonctionnalité PDF chargée - Prêt pour l\'export', 'info');
    }
});