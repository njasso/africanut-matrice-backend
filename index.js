import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import MemberCard from '../components/MemberCard';
import jsPDF from 'jspdf';

export default function MembersListPage() {
  const [allMembers, setAllMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [allCollectionsData, setAllCollectionsData] = useState({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    specialty: '',
    location: '',
    status: ''
  });
  
  const debounceRef = useRef(null);

  // Configuration AppWrite
  const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6917d4340008cda26023';
  const APPWRITE_FUNCTION_ID = import.meta.env.VITE_APPWRITE_FUNCTION_ID || '6917e0420005d9ac19c9';
  const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';

  // 🔹 Fonction utilitaire pour normaliser les données - VERSION CORRIGÉE
  const normalizeMemberData = (members) => {
    if (!Array.isArray(members)) return [];
    
    return members.map(member => {
      console.log('🔍 Normalisation frontend:', { 
        name: member.name, 
        specialties: member.specialties,
        skills: member.skills 
      });

      // 🔹 CONVERSION DES SPÉCIALITÉS
      let specialties = [];
      if (Array.isArray(member.specialties)) {
        specialties = member.specialties
          .map(spec => {
            if (typeof spec === 'string') return spec.trim();
            return String(spec).trim();
          })
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
      } else if (typeof member.specialties === 'string') {
        specialties = member.specialties
          .split(/[,;|]/)
          .map(spec => spec.trim())
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
      }

      // 🔹 CONVERSION DES COMPÉTENCES
      let skills = [];
      if (Array.isArray(member.skills)) {
        skills = member.skills
          .map(skill => {
            if (typeof skill === 'string') return skill.trim();
            return String(skill).trim();
          })
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
      } else if (typeof member.skills === 'string') {
        skills = member.skills
          .split(/[,;|]/)
          .map(skill => skill.trim())
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
      }

      // 🔹 CORRECTION DU CHEMIN DE LA PHOTO
      let photoUrl = member.photo || '';
      if (photoUrl) {
        if (photoUrl.startsWith('../assets/photos/')) {
          photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
        }
        // Si c'est un chemin relatif sans domaine
        if (photoUrl.startsWith('/') && !photoUrl.startsWith('//') && !photoUrl.startsWith('http')) {
          photoUrl = `${window.location.origin}${photoUrl}`;
        }
      }

      const normalizedMember = {
        // Champs de base
        _id: member._id || member.id,
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        location: member.location || '',
        
        // Organisation/Entreprise
        organization: member.organization || member.entreprise || '',
        entreprise: member.entreprise || member.organization || '',
        
        // 🔹 TABLEAUX CORRIGÉS
        specialties: specialties,
        skills: skills,
        
        // Autres champs
        projects: member.projects || '',
        bio: member.bio || '',
        statutMembre: member.statutMembre || 'Actif',
        experienceYears: member.experienceYears || 0,
        photo: photoUrl,
        cvLink: member.cvLink || '',
        linkedin: member.linkedin || '',
        availability: member.availability || '',
        
        // Pour compatibilité
        isActive: member.isActive !== undefined ? member.isActive : true
      };

      console.log('✅ Membre normalisé frontend:', {
        name: normalizedMember.name,
        specialties: normalizedMember.specialties,
        skills: normalizedMember.skills
      });

      return normalizedMember;
    });
  };

  // 🔹 Charger toutes les données depuis AppWrite - VERSION ULTRA-SIMPLIFIÉE
const fetchAllMembers = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    console.log('🔄 Chargement des données depuis AppWrite...');

    const appwriteUrl = `${APPWRITE_ENDPOINT}/functions/${APPWRITE_FUNCTION_ID}/executions`;

    // 🔥 CORRECTION : Payload minimal et correct
    const requestPayload = {
      data: JSON.stringify({
        path: '/api/v1/all-data/matrix-data',
        method: 'GET'
      })
    };

    console.log('📤 Envoi requête à AppWrite...');

    const response = await axios.post(
      appwriteUrl,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_PROJECT_ID,
        },
        timeout: 15000
      }
    );

    console.log('📨 Réponse AppWrite reçue:', response.data);

    // 🔥 CORRECTION : Extraction directe et simple
    let membersData = [];
    let allData = {};

    if (response.data && response.data.responseBody) {
      try {
        const responseBody = JSON.parse(response.data.responseBody);
        console.log('✅ ResponseBody parsé:', responseBody);

        if (responseBody.success && responseBody.data) {
          allData = responseBody.data;
          membersData = allData.members || [];
          console.log(`✅ ${membersData.length} membres extraits`);
        } else {
          console.log('⚠️ ResponseBody sans données valides');
        }
      } catch (parseError) {
        console.error('❌ Erreur parsing responseBody:', parseError);
      }
    }

    // Si pas de données, utiliser des données de test
    if (membersData.length === 0) {
      console.log('🔄 Utilisation de données de test...');
      membersData = [
        {
          _id: 'test-1',
          name: 'Jean Dupont',
          title: 'Développeur Fullstack',
          email: 'jean.dupont@example.com',
          organization: 'Tech Corp',
          specialties: ['JavaScript', 'React'],
          skills: ['Frontend', 'Backend'],
          location: 'Paris',
          statutMembre: 'Actif'
        },
        {
          _id: 'test-2',
          name: 'Marie Martin',
          title: 'Designer UX/UI',
          email: 'marie.martin@example.com', 
          organization: 'Design Studio',
          specialties: ['UI Design'],
          skills: ['Figma'],
          location: 'Lyon',
          statutMembre: 'Actif'
        }
      ];
      allData = { members: membersData };
    }

    // Normaliser et mettre à jour l'état
    const normalizedMembers = normalizeMemberData(membersData);
    setAllMembers(normalizedMembers);
    setFilteredMembers(normalizedMembers);
    setAllCollectionsData(allData);

    console.log(`✅ ${normalizedMembers.length} membres chargés`);

  } catch (err) {
    console.error('❌ Erreur de chargement:', err);
    setError(`Erreur: ${err.message}`);
    setAllMembers([]);
    setFilteredMembers([]);
  } finally {
    setLoading(false);
  }
}, [APPWRITE_PROJECT_ID, APPWRITE_FUNCTION_ID, APPWRITE_ENDPOINT]);
  // 🔹 Fonction pour générer et télécharger le PDF - VERSION CORRIGÉE
  const generateFullPDF = () => {
    if (allMembers.length === 0) {
      alert('Aucun membre à exporter');
      return;
    }

    const doc = new jsPDF();
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.statutMembre === 'Actif').length;

    // === PAGE 1 : COUVERTURE ===
    doc.setFillColor(45, 55, 72);
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont(undefined, 'bold');
    doc.text('ANNUAIRE DES MEMBRES', 105, 70, { align: 'center' });
    
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(2);
    doc.line(55, 80, 155, 80);
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('Profils Complets des Professionnels', 105, 95, { align: 'center' });
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(11);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 110, { align: 'center' });

    // Statistiques
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('📊 STATISTIQUES', 105, 140, { align: 'center' });
    
    const stats = [
      { label: 'Total Membres', value: totalMembers, emoji: '👥', color: [59, 130, 246] },
      { label: 'Actifs', value: activeMembers, emoji: '✅', color: [34, 197, 94] },
      { label: 'En Attente', value: totalMembers - activeMembers, emoji: '⏳', color: [251, 146, 60] }
    ];
    
    stats.forEach((stat, index) => {
      const x = 30 + (index * 60);
      doc.setFillColor(55, 65, 81);
      doc.roundedRect(x, 157, 50, 50, 4, 4, 'F');
      doc.setFillColor(...stat.color);
      doc.roundedRect(x, 155, 50, 50, 4, 4, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(stat.emoji, x + 25, 170, { align: 'center' });
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text(stat.value.toString(), x + 25, 187, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(stat.label, x + 25, 197, { align: 'center' });
    });

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Données actualisées en temps réel', 105, 270, { align: 'center' });

    // === PAGES DE PROFILS ===
    allMembers.forEach((member, index) => {
      if (index > 0) doc.addPage();
      
      // En-tête
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setFillColor(255, 255, 255);
      doc.circle(25, 17.5, 8, 'F');
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}`, 25, 19.5, { align: 'center' });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('PROFIL MEMBRE', 105, 22, { align: 'center' });

      let yPos = 50;

      // Carte membre
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, yPos, 180, 85, 5, 5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, yPos, 180, 85, 5, 5, 'S');
      
      // Initiales
      const initials = (member.name || 'NN')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      
      doc.setFillColor(99, 102, 241);
      doc.circle(30, yPos + 25, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(initials, 30, yPos + 27, { align: 'center' });

      // Nom et titre
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      const name = member.name || 'Nom non renseigné';
      doc.text(name.length > 30 ? name.substring(0, 27) + '...' : name, 45, yPos + 20);
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 116, 139);
      const title = member.title || 'Titre non renseigné';
      doc.text(title.length > 40 ? title.substring(0, 37) + '...' : title, 45, yPos + 27);

      // Statut
      const status = member.statutMembre || 'Inconnu';
      const statusColors = {
        'Actif': [34, 197, 94],
        'En attente': [251, 146, 60],
        'Inactif': [239, 68, 68]
      };
      const statusColor = statusColors[status] || [156, 163, 175];
      
      doc.setFillColor(...statusColor);
      doc.roundedRect(160, yPos + 15, 30, 12, 6, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text(status.toUpperCase(), 175, yPos + 22, { align: 'center' });

      // Contact
      yPos += 40;
      const contactInfo = [
        { icon: '📧', value: member.email || 'Non renseigné' },
        { icon: '📞', value: member.phone || 'Non renseigné' },
        { icon: '📍', value: member.location || 'Non renseignée' }
      ];

      contactInfo.forEach((info, i) => {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(info.icon, 20, yPos + (i * 8));
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
        const text = info.value.length > 45 ? info.value.substring(0, 42) + '...' : info.value;
        doc.text(text, 28, yPos + (i * 8));
      });

      yPos += 30;

      // Organisation
      if (member.organization || member.entreprise) {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(15, yPos, 180, 20, 3, 3, 'F');
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('🏢 ORGANISATION', 20, yPos + 7);
        
        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        const org = member.organization || member.entreprise || '';
        const orgText = org.length > 50 ? org.substring(0, 47) + '...' : org;
        doc.text(orgText, 20, yPos + 14);
        
        yPos += 25;
      }

      // Spécialités - CORRIGÉ POUR TABLEAUX
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(15, yPos, 85, 45, 3, 3, 'F');
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('🎯 SPÉCIALITÉS', 20, yPos + 8);
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(51, 65, 85);
      
      const specialties = Array.isArray(member.specialties) ? member.specialties : [];
      if (specialties.length > 0) {
        specialties.slice(0, 4).forEach((spec, i) => {
          const specText = spec.length > 25 ? spec.substring(0, 22) + '...' : spec;
          doc.setFillColor(219, 234, 254);
          doc.roundedRect(20, yPos + 12 + (i * 7), 60, 5, 2, 2, 'F');
          doc.text(`• ${specText}`, 22, yPos + 15 + (i * 7));
        });
        if (specialties.length > 4) {
          doc.setTextColor(100, 116, 139);
          doc.text(`+${specialties.length - 4} autre(s)`, 20, yPos + 40);
        }
      } else {
        doc.setTextColor(156, 163, 175);
        doc.text('Aucune spécialité', 20, yPos + 15);
      }

      // Compétences - CORRIGÉ POUR TABLEAUX
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(110, yPos, 85, 45, 3, 3, 'F');
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('💡 COMPÉTENCES', 115, yPos + 8);
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(51, 65, 85);
      
      const skills = Array.isArray(member.skills) ? member.skills : [];
      if (skills.length > 0) {
        skills.slice(0, 4).forEach((skill, i) => {
          const skillText = skill.length > 25 ? skill.substring(0, 22) + '...' : skill;
          doc.setFillColor(254, 215, 170);
          doc.roundedRect(115, yPos + 12 + (i * 7), 60, 5, 2, 2, 'F');
          doc.text(`• ${skillText}`, 117, yPos + 15 + (i * 7));
        });
        if (skills.length > 4) {
          doc.setTextColor(100, 116, 139);
          doc.text(`+${skills.length - 4} autre(s)`, 115, yPos + 40);
        }
      } else {
        doc.setTextColor(156, 163, 175);
        doc.text('Aucune compétence', 115, yPos + 15);
      }

      yPos += 50;

      // Projets
      if (member.projects) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(15, yPos, 180, 30, 3, 3, 'F');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(21, 128, 61);
        doc.text('🚀 PROJETS', 20, yPos + 8);
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(51, 65, 85);
        
        const projects = member.projects.length > 120 
          ? member.projects.substring(0, 117) + '...' 
          : member.projects;
        
        const lines = doc.splitTextToSize(projects, 170);
        doc.text(lines.slice(0, 3), 20, yPos + 15);
        
        yPos += 35;
      }

      // Bio
      if (member.bio) {
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(15, yPos, 180, 35, 3, 3, 'F');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(75, 85, 99);
        doc.text('📝 BIOGRAPHIE', 20, yPos + 8);
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        
        const bio = member.bio.length > 200 
          ? member.bio.substring(0, 197) + '...' 
          : member.bio;
        
        const bioLines = doc.splitTextToSize(bio, 170);
        doc.text(bioLines.slice(0, 4), 20, yPos + 15);
      }

      // Pied de page
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text(`Profil ${index + 1} sur ${totalMembers}`, 105, 287, { align: 'center' });
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 292, { align: 'center' });
    });

    // Téléchargement
    const fileName = `annuaire-membres-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // 🔹 Fonction pour extraire le texte de recherche - VERSION CORRIGÉE
  const getSearchableText = (member) => {
    const specialtiesText = Array.isArray(member.specialties) 
      ? member.specialties.join(' ') 
      : member.specialties || '';
    
    const skillsText = Array.isArray(member.skills) 
      ? member.skills.join(' ') 
      : member.skills || '';

    return `
      ${member.name || ''}
      ${member.title || ''}
      ${member.email || ''}
      ${specialtiesText}
      ${skillsText}
      ${member.location || ''}
      ${member.entreprise || ''}
      ${member.organization || ''}
      ${member.projects || ''}
      ${member.statutMembre || ''}
    `.toLowerCase();
  };

  // 🔹 Fonction utilitaire pour les icônes des collections
  const getCollectionIcon = (collection) => {
    const icons = {
      members: '👥',
      projects: '🚀',
      skills: '💡',
      specialties: '🎯',
      groups: '👨‍👩‍👧‍👦',
      interactions: '💬',
      analyses: '📈'
    };
    return icons[collection] || '📁';
  };

  // 🔹 Chargement initial
  useEffect(() => {
    fetchAllMembers();
  }, [fetchAllMembers]);

  // 🔹 Filtrer les membres localement - VERSION CORRIGÉE
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      let results = [...allMembers];

      if (q.trim()) {
        const searchTerm = q.trim().toLowerCase();
        results = results.filter(member => {
          const searchableText = getSearchableText(member);
          return searchableText.includes(searchTerm);
        });
      }

      if (filters.specialty) {
        const specialtyTerm = filters.specialty.toLowerCase();
        results = results.filter(member => {
          const specialties = Array.isArray(member.specialties) 
            ? member.specialties 
            : [member.specialties || ''];
          return specialties.some(spec => 
            spec && spec.toLowerCase().includes(specialtyTerm)
          );
        });
      }

      if (filters.location) {
        results = results.filter(member => 
          member.location?.toLowerCase().includes(filters.location.toLowerCase())
        );
      }

      if (filters.status) {
        results = results.filter(member => 
          member.statutMembre?.toLowerCase() === filters.status.toLowerCase()
        );
      }

      setFilteredMembers(results);
      
      console.log(`🔍 Filtrage: ${allMembers.length} → ${results.length} membres`);
      
    }, 300);
    
    return () => clearTimeout(debounceRef.current);
  }, [q, filters, allMembers]);

  // 🔹 Gestion du changement de filtre
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // 🔹 Réinitialisation des filtres
  const handleResetFilters = () => {
    setQ('');
    setFilters({
      specialty: '',
      location: '',
      status: ''
    });
  };

  // 🔹 Rechargement des données
  const handleReload = () => {
    fetchAllMembers();
  };

  // 🔹 Statistiques
  const activeFiltersCount = [
    q.trim(),
    filters.specialty,
    filters.location,
    filters.status
  ].filter(Boolean).length;

  const totalCollections = Object.keys(allCollectionsData).length;

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1400px', 
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      {/* En-tête */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '2.5rem', 
              fontWeight: '800',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Annuaire des Membres
            </h1>
            <p style={{ 
              margin: '0', 
              color: '#64748b',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Données en direct depuis votre base MongoDB
            </p>
            {error && (
              <div style={{ 
                marginTop: '10px',
                padding: '15px',
                backgroundColor: '#fef3f2',
                border: '1px solid #fecdca',
                borderRadius: '8px',
                color: '#b42318'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span>⚠️</span>
                  <strong>Erreur de chargement</strong>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>{error}</p>
                <button
                  onClick={handleReload}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#b42318',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🔄 Réessayer
                </button>
              </div>
            )}
          </div>
          
          {/* Bouton PDF */}
          <button
            onClick={generateFullPDF}
            disabled={allMembers.length === 0}
            style={{
              padding: '14px 24px',
              background: allMembers.length === 0 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: allMembers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: '220px',
              boxShadow: allMembers.length === 0 ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)',
              opacity: allMembers.length === 0 ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (allMembers.length > 0) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (allMembers.length > 0) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>📄</span>
            Exporter PDF
            {allMembers.length > 0 && (
              <span style={{ 
                fontSize: '12px', 
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '10px',
                marginLeft: 'auto'
              }}>
                {allMembers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Section Statistiques des Collections */}
      {!loading && totalCollections > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '30px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '1.5rem',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Base de Données
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '20px' 
          }}>
            {Object.keys(allCollectionsData).map(collection => (
              <div key={collection} style={{
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #e2e8f0',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  marginBottom: '12px'
                }}>
                  {getCollectionIcon(collection)}
                </div>
                <div style={{ 
                  fontWeight: '700', 
                  color: '#374151',
                  textTransform: 'capitalize',
                  marginBottom: '8px',
                  fontSize: '1.1rem'
                }}>
                  {collection}
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '800',
                  color: '#3b82f6'
                }}>
                  {allCollectionsData[collection].length}
                </div>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  documents
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '16px',
        marginBottom: '30px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {/* Barre de recherche */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#374151',
              fontSize: '14px'
            }}>
              <span style={{ marginRight: '8px' }}>🔍</span>
              Recherche
            </label>
            <input
              placeholder="Nom, compétences, spécialités, localisation..."
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ 
                padding: '12px 16px', 
                width: '100%',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '15px',
                backgroundColor: '#f9fafb'
              }}
            />
          </div>

          {/* Filtre spécialité */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#374151',
              fontSize: '14px'
            }}>
              <span style={{ marginRight: '8px' }}>🎯</span>
              Spécialité
            </label>
            <select
              value={filters.specialty}
              onChange={e => handleFilterChange('specialty', e.target.value)}
              style={{ 
                padding: '12px 16px', 
                width: '100%',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '15px',
                backgroundColor: '#f9fafb',
                cursor: 'pointer'
              }}
            >
              <option value="">Toutes les spécialités</option>
              <option value="Énergie">Énergie</option>
              <option value="solaire">Énergie solaire</option>
              <option value="Smart grid">Smart grid</option>
              <option value="Hydraulique">Hydraulique</option>
              <option value="Environnement">Environnement</option>
              <option value="Agro-industrie">Agro-industrie</option>
              <option value="Aménagement Forestier">Aménagement Forestier</option>
              <option value="Sylviculture">Sylviculture</option>
            </select>
          </div>

          {/* Filtre localisation */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#374151',
              fontSize: '14px'
            }}>
              <span style={{ marginRight: '8px' }}>📍</span>
              Localisation
            </label>
            <select
              value={filters.location}
              onChange={e => handleFilterChange('location', e.target.value)}
              style={{ 
                padding: '12px 16px', 
                width: '100%',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '15px',
                backgroundColor: '#f9fafb',
                cursor: 'pointer'
              }}
            >
              <option value="">Toutes les localisations</option>
              <option value="Douala">Douala</option>
              <option value="Yaoundé">Yaoundé</option>
              <option value="Bafoussam">Bafoussam</option>
              <option value="Ngaoundéré">Ngaoundéré</option>
            </select>
          </div>

          {/* Filtre statut */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#374151',
              fontSize: '14px'
            }}>
              <span style={{ marginRight: '8px' }}>📊</span>
              Statut
            </label>
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              style={{ 
                padding: '12px 16px', 
                width: '100%',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '15px',
                backgroundColor: '#f9fafb',
                cursor: 'pointer'
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="En attente">En attente</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {filteredMembers.length} sur {allMembers.length} membres
            </div>
            {activeFiltersCount > 0 && (
              <div style={{
                padding: '6px 12px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {activeFiltersCount} filtre(s) actif(s)
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleReload}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🔄</span>
              Actualiser
            </button>
            
            <button
              onClick={handleResetFilters}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🗑️</span>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* État de chargement */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          color: '#4b5563',
          backgroundColor: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            animation: 'pulse 2s infinite'
          }}>⏳</div>
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Chargement des données...</p>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            Connexion à la base de données
          </p>
        </div>
      )}

      {/* Liste des membres */}
      {!loading && (
        <>
          {filteredMembers.length === 0 && allMembers.length > 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px',
              color: '#6b7280',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                fontSize: '64px', 
                marginBottom: '20px',
                opacity: 0.5
              }}>🔍</div>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                color: '#374151',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                Aucun membre trouvé
              </h3>
              <p style={{ margin: 0, fontSize: '15px' }}>
                Essayez de modifier vos critères de recherche.
              </p>
            </div>
          ) : filteredMembers.length > 0 ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
              gap: '24px'
            }}>
              {filteredMembers.map(member => (
                <MemberCard 
                  key={member._id} 
                  member={member}
                />
              ))}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px',
              color: '#6b7280',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                fontSize: '64px', 
                marginBottom: '20px',
                opacity: 0.5
              }}>📭</div>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                color: '#374151',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                Aucune donnée disponible
              </h3>
              <p style={{ margin: 0, fontSize: '15px' }}>
                {error ? error : 'Les données seront disponibles après configuration.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
