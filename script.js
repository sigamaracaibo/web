    // Importamos las funciones y objetos de Firebase desde app.js
    import { db, auth, secondaryAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, collection, getDocs, setDoc, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, query, where, deleteDoc, updateDoc } from './app.js';

    /**
     * SIGA - Sistema de Gestión Académica
     * Autor: Gemini
     * Versión: 2.0 (Base)
     * Descripción: Aplicación de una sola página (SPA) en JavaScript puro
     * para la gestión de horarios y asistencia universitaria, con simulación
     * de base de datos NoSQL mediante localStorage.
     */

    document.addEventListener('DOMContentLoaded', () => {
        
        // ===================================================================
        //                        MÓDULO DE AUTENTICACIÓN
        // ===================================================================
        const Auth = {
            currentUser: null,
            // Función para obtener el perfil de Firestore y establecer la sesión
            fetchAndSetUser: async (firebaseUser) => {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    Auth.currentUser = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        ...userDocSnap.data() // Incluye rol, nombre, etc.
                    };
                    // Opcional: Guardar en sessionStorage para un acceso más rápido si es necesario en otras partes
                    sessionStorage.setItem('siga_user', JSON.stringify(Auth.currentUser));
                    return true;
                } else {
                    console.error("Error Crítico: El usuario está autenticado pero no tiene perfil en Firestore.");
                    await signOut(auth); // Cerramos sesión por seguridad
                    return false;
                }
            },
            login: async (email, password) => {
                try {
                    const rememberMe = document.getElementById('remember-me-checkbox').checked;
                    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
                    
                    // 1. Establecer la persistencia de la sesión ANTES de iniciar sesión
                    await setPersistence(auth, persistence);

                    // 2. Iniciar sesión
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    return true; // El login en Firebase fue exitoso
                } catch (error) {
                    // MODIFICACIÓN CLAVE: Devolvemos el mensaje de error real de Firebase
                    console.error("Error de inicio de sesión:", error.code, error.message); 
                    // Mapeamos los errores comunes a mensajes más amigables en español
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                        return 'El correo o la contraseña son incorrectos.';
                    }
                    // Para otros errores (red, configuración, etc.), mostramos un mensaje más técnico
                    return `Error: ${error.code}`;
                }
            },
            logout: async () => {
                await signOut(auth);
                Auth.currentUser = null;
                sessionStorage.clear(); // Limpiamos toda la sesión
                App.showLoginScreen();
            },
            getRole: () => Auth.currentUser ? Auth.currentUser.rol : null, // Cambiado de .role a .rol
            canEdit: () => {
                const role = Auth.getRole();
                return role === 'admin' || role === 'director';
            }
        };

        // ===================================================================
        //                     LÓGICA PRINCIPAL DE LA APLICACIÓN (App)
        // ===================================================================
        const App = {
            init: () => {
                const statusIcon = document.getElementById('connection-status');
                // onAuthStateChanged es el único punto de verdad para el estado de la sesión.
                onAuthStateChanged(auth, async (user) => {
                    // Si esta función se ejecuta, significa que la conexión con Firebase Auth es exitosa.
                    statusIcon.classList.remove('status-error');
                    statusIcon.classList.add('status-ok');

                    if (user) { // Si Firebase dice que hay un usuario...
                        console.log("🔍 onAuthStateChanged: Usuario detectado en Firebase.", user.uid);
                        // ...buscamos su perfil en Firestore para obtener el rol.
                        const profileExists = await Auth.fetchAndSetUser(user);
                        if (profileExists) {
                            console.log("✅ Perfil de usuario encontrado en Firestore. Mostrando panel.");
                            App.showAppPanel();
                        } else {
                            // Si no tiene perfil, lo mandamos al login.
                            console.error("❌ Perfil de usuario NO encontrado. Cerrando sesión.");
                            statusIcon.title = "Error: Perfil de usuario no encontrado en la base de datos.";
                            statusIcon.classList.add('status-error');
                            App.showLoginScreen();
                        }
                    } else {
                        // Si no hay usuario, mostramos el login.
                        console.log("🚪 onAuthStateChanged: No hay usuario en Firebase. Mostrando login.");
                        App.showLoginScreen();
                    }
                });

                document.getElementById('login-form').addEventListener('submit', App.handleLogin);
                document.getElementById('logout-btn').addEventListener('click', Auth.logout);
                window.addEventListener('hashchange', Router.handleRouteChange);
                window.addEventListener('resize', App.handleResize);
                // Eventos para modales
                document.querySelectorAll('[data-dismiss="modal"]').forEach(el => {
                    el.addEventListener('click', () => el.closest('.modal').classList.remove('show'));
                });
                // Inicializar el módulo de perfil para que el botón funcione
                const profileContainer = document.getElementById('profile-picture-container');
                profileContainer.addEventListener('click', () => {
                    Modules.perfil.openProfileModal();
                });
                document.addEventListener('mousemove', App.handleParallax);
                Theme.init();
                App.handleResize();
            },
            showLoginScreen: () => {
                document.getElementById('root').classList.add('login-active');
                // Habilitar el parallax en la pantalla de login
                const shapesContainer = document.getElementById('login-background-shapes');
                if (shapesContainer) {
                    shapesContainer.style.display = 'block';
                    setTimeout(() => {
                        shapesContainer.style.opacity = '1';
                    }, 10);
                }
                // Asegurarse de que el sidebar no esté visible en la pantalla de login
                document.getElementById('app').classList.remove('sidebar-visible');
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('app').classList.remove('visible');
            },
            showAppPanel: () => {
                const splashScreen = document.getElementById('splash-screen');
                
                // 1. Ocultar el login y el fondo animado
                document.getElementById('login-screen').classList.add('hidden');
                const shapesContainer = document.getElementById('login-background-shapes');
                if (shapesContainer) { shapesContainer.style.opacity = '0'; }

                // 2. Mostrar la pantalla de carga
                splashScreen.classList.remove('hidden');

                // 3. Simular un tiempo de carga y luego mostrar el panel
                setTimeout(() => {
                    // Ocultar la pantalla de carga
                    splashScreen.classList.add('hidden');

                    // Mostrar el panel principal
                    document.getElementById('root').classList.remove('login-active');
                    document.getElementById('app').classList.add('visible');
                    App.setupUIForUser();
                    // Forzamos la navegación al dashboard después de iniciar sesión
                    location.hash = '#/dashboard';
                    Router.handleRouteChange(); // Ahora el router leerá la nueva URL
                    App.setupResponsiveMenu();
                }, 2500); // 2.5 segundos de pantalla de carga
            },
            handleLogin: async (e) => {
                e.preventDefault();
                const email = document.getElementById('username-input').value; // El campo ahora es email
                const password = document.getElementById('password-input').value;
                const errorEl = document.getElementById('login-error');
                const loginResult = await Auth.login(email, password);

                // Si el resultado NO es 'true', significa que hubo un error y loginResult contiene el mensaje.
                if (loginResult !== true) {
                    errorEl.textContent = loginResult; // Mostramos el mensaje de error específico
                    errorEl.classList.add('show');
                    setTimeout(() => errorEl.classList.remove('show'), 3000);
                }
                // Si loginResult es 'true', no hacemos nada aquí. onAuthStateChanged se encargará de mostrar el panel.
            },
            setupUIForUser: () => {
                if (!Auth.currentUser) return;
                document.getElementById('username-display').textContent = Auth.currentUser.nombre || 'Usuario'; // Usamos 'nombre' de Firestore
                document.getElementById('user-role-display').textContent = Auth.currentUser.rol ? Auth.currentUser.rol.charAt(0).toUpperCase() + Auth.currentUser.rol.slice(1) : 'Sin rol'; // Cambiado de .role a .rol
                App.updateProfilePicture();
                const navMenu = document.getElementById('nav-menu');
                const role = Auth.getRole();
                
                // Menú dinámico según el rol
                let menuHTML = `<a href="#/dashboard" id="nav-dashboard" data-route="dashboard">📊 <span>Dashboard</span></a>`;
                
                // Solo los administradores ven el módulo de usuarios
                if (role === 'admin') {
                    menuHTML += `<a href="#/usuarios" id="nav-usuarios" data-route="usuarios">👥 <span>Usuarios</span></a>`;
                }

                // Profesores, directores y admins ven el módulo de disponibilidad
                const availabilityRoles = ['profesor', 'director', 'admin'];
                if (availabilityRoles.includes(role)) {
                    menuHTML += `<a href="#/disponibilidad" id="nav-disponibilidad" data-route="disponibilidad">🗓️ <span>Disponibilidad</span></a>`;
                }

                // Directores y admins ven el plan de estudio
                const curriculumRoles = ['director', 'admin'];
                if (curriculumRoles.includes(role)) {
                    menuHTML += `<a href="#/plan-de-estudio" id="nav-plan-de-estudio" data-route="plan-de-estudio">📚 <span>Plan de Estudio</span></a>`;
                }


                navMenu.innerHTML = menuHTML;
            },
            updateProfilePicture: () => {
                const container = document.getElementById('profile-picture-container');
                if (!container || !Auth.currentUser) return;

                container.innerHTML = ''; // Limpiar contenido anterior
                if (Auth.currentUser.photo) {
                    container.style.backgroundImage = `url(${Auth.currentUser.photo})`;
                } else {
                    // Mostrar iniciales si no hay foto
                    const initials = (Auth.currentUser.nombre || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    container.style.backgroundImage = 'none';
                    container.textContent = initials;
                }
            },
            setupResponsiveMenu: () => {
                const appContainer = document.getElementById('app');
                const hamburgerBtn = document.getElementById('hamburger-btn');
                const overlay = document.querySelector('.sidebar-overlay');
                const navMenu = document.getElementById('nav-menu');
                if (!appContainer || !hamburgerBtn || !overlay || !navMenu) return;
                if (hamburgerBtn.dataset.bound === 'true') return;
                const toggleSidebar = () => appContainer.classList.toggle('sidebar-visible');
                hamburgerBtn.addEventListener('click', toggleSidebar);
                overlay.addEventListener('click', () => appContainer.classList.remove('sidebar-visible'));
                navMenu.addEventListener('click', (e) => {
                    if (e.target.closest('a') && window.innerWidth <= 992) {
                        appContainer.classList.remove('sidebar-visible');
                    }
                });
                hamburgerBtn.dataset.bound = 'true';
            },
            handleResize: () => {
                if (window.innerWidth > 992) {
                    const appContainer = document.getElementById('app');
                    if (appContainer) {
                        appContainer.classList.remove('sidebar-visible');
                    }
                }
            },
            handleParallax: (e) => {
                // Solo ejecutar este efecto en la pantalla de login
                if (!document.getElementById('root').classList.contains('login-active')) {
                    return;
                }
        
                const shapesContainer = document.getElementById('login-background-shapes');
                if (!shapesContainer) return;
        
                const { clientX, clientY } = e;
                const { innerWidth, innerHeight } = window;
        
                // Calcular la desviación desde el centro (-0.5 a 0.5)
                const deviationX = (clientX / innerWidth) - 0.5;
                const deviationY = (clientY / innerHeight) - 0.5;
        
                // Aplicar la transformación con una intensidad reducida
                const moveX = -deviationX * 30; // 30px de movimiento máximo
                const moveY = -deviationY * 30;
                shapesContainer.style.transform = `translate(${moveX}px, ${moveY}px)`;
            },
        };

        // ===================================================================
        //                           ENRUTADOR (Router)
        // ===================================================================
        const Router = {
            handleRouteChange: () => {
                if (!Auth.currentUser) {
                    App.showLoginScreen();
                    return;
                }
                const path = location.hash.slice(2) || Router.getDefaultRouteForRole();
                const [mainRoute, subRoute] = path.split('/');
                Router.renderModule(mainRoute, subRoute);
                Router.updateUI(mainRoute, subRoute);
            },
            getDefaultRouteForRole: () => {
                const role = Auth.getRole();
                const defaultRoutes = {
                    admin: 'dashboard'
                };
                return defaultRoutes[role] || 'dashboard';
            },
            renderModule: (mainRoute, subRoute) => {
                const pageContent = document.getElementById('page-content');
                const templateId = `template-${mainRoute}`;
                const template = document.getElementById(templateId);

                if (template) {
                    pageContent.innerHTML = template.innerHTML;
                    pageContent.querySelector('.module-content')?.classList.add('active');
                    
                    // Inicializar el módulo correspondiente
                    if (Modules[mainRoute] && typeof Modules[mainRoute].init === 'function') {
                        Modules[mainRoute].init();
                    }
                }
                else {
                    pageContent.innerHTML = `<div class="card"><div class="card-body"><h2>Página no encontrada: ${mainRoute}</h2></div></div>`;
                }
            },
            updateUI: (mainRoute, subRoute) => {
                const navId = `nav-${mainRoute}${subRoute ? `-${subRoute}` : ''}`;
                const titleEl = document.getElementById(navId);
                document.getElementById('page-title').textContent = titleEl ? titleEl.textContent.replace(/[-_]/g, ' ').trim() : 'Tablero';
                document.querySelectorAll('#nav-menu a').forEach(a => a.classList.remove('active'));
                if (titleEl) {
                    titleEl.classList.add('active');
                    const parentNav = document.getElementById(`nav-${mainRoute}`);
                    if (parentNav && parentNav !== titleEl) {
                        parentNav.classList.add('active');
                    }
                } else {
                     document.getElementById(`nav-${mainRoute}`)?.classList.add('active');
                }
                if (window.innerWidth <= 992) {
                    document.getElementById('app')?.classList.remove('sidebar-visible');
                }
            }
        };

        // ===================================================================
        //                           GESTIÓN DEL TEMA (Theme)
        // ===================================================================
        const Theme = {
            init: () => {
                const themeToggle = document.getElementById('theme-checkbox');
                if (themeToggle) {
                    themeToggle.addEventListener('change', Theme.toggleTheme);
                }

                // Aplicar el tema guardado al cargar la página
                if (localStorage.getItem('siga_theme') === 'dark') {
                    document.body.classList.add('dark-mode');
                    if (themeToggle) themeToggle.checked = true;
                }
            },
            toggleTheme: () => {
                if (document.body.classList.contains('dark-mode')) {
                    document.body.classList.remove('dark-mode');
                    localStorage.setItem('siga_theme', 'light');
                } else {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('siga_theme', 'dark');
                }
            }
        };
        // ===================================================================
        //                   MÓDULOS DE LA APLICACIÓN
        // ===================================================================
        const Modules = {
            // Aquí puedes empezar a añadir tus nuevos módulos.
            perfil: {
                unsplashAccessKey: 'wUxayRFny7kiKQkS6Vi7Ktxu3CBi-Y3YSruxVQFvQKY',
                openProfileModal: () => {
                    const modal = document.getElementById('profile-modal');
                    const preview = document.getElementById('profile-photo-preview');
                    const selectedPhotoInput = document.getElementById('selected-photo-url');
                    const unsplashGallery = document.getElementById('unsplash-gallery');
                    const searchInput = document.getElementById('unsplash-search-input');

                    // Cargar foto actual
                    preview.src = Auth.currentUser.photo || 'img/avatars/default.png';
                    selectedPhotoInput.value = Auth.currentUser.photo || '';

                    // Búsqueda en Unsplash
                    searchInput.onkeydown = async (e) => {
                        if (e.key === 'Enter' && searchInput.value.trim()) {
                            e.preventDefault();
                            unsplashGallery.innerHTML = '<p>Buscando...</p>';
                            const results = await Modules.perfil.searchUnsplash(searchInput.value);
                            Modules.perfil.renderUnsplashResults(results);
                        }
                    };

                    document.getElementById('profile-form').onsubmit = Modules.perfil.handleProfileSubmit;
                    modal.classList.add('show');
                },
                searchUnsplash: async (query) => {
                    const endpoint = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&client_id=${Modules.perfil.unsplashAccessKey}`;
                    try {
                        const response = await fetch(endpoint);
                        if (!response.ok) {
                            throw new Error(`Error de Unsplash: ${response.statusText}`);
                        }
                        const data = await response.json();
                        return data.results;
                    } catch (error) {
                        console.error("Error al buscar en Unsplash:", error);
                        return [];
                    }
                },
                renderUnsplashResults: (results) => {
                    const unsplashGallery = document.getElementById('unsplash-gallery');
                    unsplashGallery.innerHTML = '';
                    if (results.length === 0) {
                        unsplashGallery.innerHTML = '<p>No se encontraron resultados.</p>';
                        return;
                    }
                    results.forEach(photo => {
                        const item = document.createElement('img');
                        item.src = photo.urls.thumb;
                        item.alt = photo.alt_description;
                        item.className = 'gallery-item';
                        item.onclick = () => {
                            document.getElementById('profile-photo-preview').src = photo.urls.regular;
                            document.getElementById('selected-photo-url').value = photo.urls.regular;
                            unsplashGallery.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('selected'));
                            item.classList.add('selected');
                        };
                        unsplashGallery.appendChild(item);
                    });
                },
                handleProfileSubmit: async (e) => {
                    e.preventDefault();
                    const newPhotoUrl = document.getElementById('selected-photo-url').value;

                    try {
                        const userRef = doc(db, "users", Auth.currentUser.uid);
                        await updateDoc(userRef, {
                            photo: newPhotoUrl
                        });

                        // Actualizar la sesión local
                        Auth.currentUser.photo = newPhotoUrl;
                        sessionStorage.setItem('siga_user', JSON.stringify(Auth.currentUser));

                        App.updateProfilePicture();
                        alert('Foto de perfil actualizada exitosamente.');
                        document.getElementById('profile-modal').classList.remove('show');

                    } catch (error) {
                        console.error("Error al actualizar la foto de perfil:", error);
                        alert('Hubo un error al guardar los cambios.');
                    }
                }
            },
            dashboard: {
                clockInterval: null,
                init: () => {
                    console.log('Dashboard inicializado');
                    Modules.dashboard.startClock();
                    Modules.dashboard.fetchWeather();
                },
                startClock: () => {
                    const clockEl = document.getElementById('widget-clock');
                    const dateEl = document.getElementById('widget-date');
                    if (!clockEl || !dateEl) return;

                    if (Modules.dashboard.clockInterval) {
                        clearInterval(Modules.dashboard.clockInterval);
                    }

                    const updateTime = () => {
                        const now = new Date();
                        const timeString = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const dateString = now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
                        
                        clockEl.textContent = timeString;
                        dateEl.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
                    };

                    updateTime();
                    Modules.dashboard.clockInterval = setInterval(updateTime, 1000);
                },
                fetchWeather: async () => {
                    const iconEl = document.getElementById('widget-weather-icon');
                    const tempEl = document.getElementById('widget-temperature');
                    if (!iconEl || !tempEl) return;
                    
                    // Usamos la API de wttr.in que no requiere clave
                    const url = `https://wttr.in/Maracaibo?format=j1`;

                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error('No se pudo obtener el clima.');
                        const data = await response.json();

                        // La estructura de wttr.in es diferente
                        tempEl.textContent = `${data.current_condition[0].temp_C}°`;
                        
                        // Mapeo de CÓDIGOS de clima a iconos. Es más fiable que el texto.
                        const weatherCode = data.current_condition[0].weatherCode;
                        const weatherIcons = {
                            '113': '☀️', // Despejado/Soleado
                            '116': '⛅', // Parcialmente nublado
                            '119': '☁️', // Nublado
                            '122': '☁️', // Muy nublado
                            '143': '🌫️', // Niebla
                            '176': '🌦️', // Posibilidad de lluvia dispersa
                            '179': '🌨️', // Posibilidad de nieve dispersa
                            '182': '🌨️', // Posibilidad de aguanieve dispersa
                            '185': '🌦️', // Posibilidad de llovizna helada dispersa
                            '200': '⛈️', // Posibilidad de tormenta
                            '227': '🌬️❄️',// Ventisca de nieve
                            '230': ' Blizzard', // Nevada fuerte
                            '248': '🌫️', // Niebla
                            '260': '🌫️', // Niebla helada
                            '263': '🌦️', // Llovizna dispersa
                            '266': '🌦️', // Llovizna ligera
                            '281': '🌧️', // Llovizna helada
                            '284': '🌧️', // Fuerte llovizna helada
                            '293': '🌧️', // Lluvia ligera dispersa
                            '296': '🌧️', // Lluvia ligera
                            '299': '🌧️', // Lluvia moderada a ratos
                            '302': '🌧️', // Lluvia moderada
                            '305': '🌧️', // Lluvia fuerte a ratos
                            '308': '🌧️', // Lluvia fuerte
                            '386': '⛈️', // Tormenta dispersa
                            '389': '⛈️'  // Tormenta fuerte
                        };
                        iconEl.textContent = weatherIcons[weatherCode] || '🌎';

                    } catch (error) {
                        console.error("Error al obtener el clima:", error);
                        tempEl.textContent = '--°';
                        iconEl.textContent = '⚠️';
                    }
                }
            },
            usuarios: {
                init: () => {
                    console.log('Módulo de Usuarios inicializado');
                    document.getElementById('add-user-btn').addEventListener('click', () => Modules.usuarios.openUserModal());
                    document.getElementById('user-form').addEventListener('submit', Modules.usuarios.handleUserFormSubmit);
                    Modules.usuarios.renderUsersTable();
                },
                openUserModal: (user = null) => {
                    const modal = document.getElementById('user-modal');
                    const form = document.getElementById('user-form');
                    form.reset();
                    // Lógica para editar (a implementar) o crear
                    document.getElementById('user-modal-title').textContent = 'Nuevo Usuario';
                    modal.classList.add('show');
                },
                renderUsersTable: async () => {
                    const tableBody = document.getElementById('users-table')?.querySelector('tbody');
                    if (!tableBody) return;

                    tableBody.innerHTML = '<tr><td colspan="4">Cargando usuarios...</td></tr>';
                    try {
                        const querySnapshot = await getDocs(collection(db, "users"));
                        if (querySnapshot.empty) {
                            tableBody.innerHTML = '<tr><td colspan="4">No se encontraron usuarios.</td></tr>';
                            return;
                        }
                        
                        tableBody.innerHTML = '';
                        querySnapshot.forEach((doc) => {
                            const user = doc.data();
                            const row = `
                                <tr>
                                    <td>${user.nombre}</td>
                                    <td>${user.email || 'No disponible'}</td>
                                    <td>${user.rol}</td>
                                    <td>
                                        <button class="btn btn-warning btn-sm">✏️</button>
                                        <button class="btn btn-danger btn-sm">🗑️</button>
                                    </td>
                                </tr>
                            `;
                            tableBody.innerHTML += row;
                        });
                    } catch (error) {
                        console.error("Error al obtener usuarios:", error);
                        tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">Error al cargar usuarios: ${error.message}</td></tr>`;
                    }
                },
                handleUserFormSubmit: async (e) => {
                    e.preventDefault();
                    const name = document.getElementById('user-name').value;
                    const email = document.getElementById('user-email').value;
                    const password = document.getElementById('user-password').value;
                    const role = document.getElementById('user-role').value;

                    try {
                        // 1. Crear el usuario en Firebase Authentication
                        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                        const newUser = userCredential.user;

                        // 2. Crear el documento de perfil en Firestore
                        await setDoc(doc(db, "users", newUser.uid), {
                            nombre: name,
                            rol: role,
                            email: email // Guardamos el email también en el perfil para facilitar la visualización
                        });

                        alert('¡Usuario creado exitosamente!');
                        document.getElementById('user-modal').classList.remove('show');
                        Modules.usuarios.renderUsersTable(); // Refrescar la tabla
                    } catch (error) {
                        console.error("Error al crear usuario:", error);
                        alert(`Error al crear usuario: ${error.message}`);
                    }
                }
            },
            'plan-de-estudio': {
                init: () => {
                    console.log('Módulo de Plan de Estudio inicializado');
                    // Listeners para botones principales
                    document.getElementById('add-career-btn').addEventListener('click', () => Modules['plan-de-estudio'].openCareerModal());
                    document.getElementById('add-subject-btn').addEventListener('click', () => Modules['plan-de-estudio'].openSubjectModal());

                    // Listeners para formularios de modales
                    document.getElementById('career-form').addEventListener('submit', Modules['plan-de-estudio'].handleCareerSubmit);
                    document.getElementById('subject-form').addEventListener('submit', Modules['plan-de-estudio'].handleSubjectSubmit);
                    document.getElementById('curriculum-form').addEventListener('submit', Modules['plan-de-estudio'].handleCurriculumSubmit);

                    // Auto-cálculo de horas totales en el modal de materias
                    const theoreticalHours = document.getElementById('subject-hours-theoretical');
                    const practicalHours = document.getElementById('subject-hours-practical');
                    const totalHours = document.getElementById('subject-hours-total');
                    const calculateTotal = () => {
                        const theoretical = parseInt(theoreticalHours.value) || 0;
                        const practical = parseInt(practicalHours.value) || 0;
                        totalHours.value = theoretical + practical;
                    };
                    theoreticalHours.addEventListener('input', calculateTotal);
                    practicalHours.addEventListener('input', calculateTotal);

                    // Cargar datos iniciales
                    Modules['plan-de-estudio'].renderCareersTable();
                    Modules['plan-de-estudio'].renderSubjectsTable();
                },

                // --- Gestión de Carreras ---
                renderCareersTable: async () => {
                    const tableBody = document.getElementById('careers-table')?.querySelector('tbody');
                    if (!tableBody) return;
                    tableBody.innerHTML = '<tr><td colspan="2">Cargando...</td></tr>';
                    try {
                        const querySnapshot = await getDocs(collection(db, "careers"));
                        tableBody.innerHTML = '';
                        if (querySnapshot.empty) {
                            tableBody.innerHTML = '<tr><td colspan="2">No hay carreras registradas.</td></tr>';
                            return;
                        }
                        querySnapshot.forEach(doc => {
                            const career = { id: doc.id, ...doc.data() };
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${career.name}</td>
                                <td>
                                    <button class="btn btn-info btn-sm btn-manage-curriculum" title="Gestionar Malla">🕸️</button>
                                    <button class="btn btn-warning btn-sm btn-edit-career">✏️</button>
                                    <button class="btn btn-danger btn-sm btn-delete-career">🗑️</button>
                                </td>
                            `;
                            row.querySelector('.btn-manage-curriculum').addEventListener('click', () => Modules['plan-de-estudio'].openCurriculumModal(career));
                            row.querySelector('.btn-edit-career').addEventListener('click', () => Modules['plan-de-estudio'].openCareerModal(career));
                            row.querySelector('.btn-delete-career').addEventListener('click', () => Modules['plan-de-estudio'].deleteCareer(career.id, career.name));
                            tableBody.appendChild(row);
                        });
                    } catch (error) {
                        console.error("Error al cargar carreras:", error);
                        tableBody.innerHTML = '<tr><td colspan="2" style="color:red;">Error al cargar carreras.</td></tr>';
                    }
                },
                openCareerModal: (career = null) => {
                    const modal = document.getElementById('career-modal');
                    document.getElementById('career-form').reset();
                    if (career) {
                        document.getElementById('career-modal-title').textContent = 'Editar Carrera';
                        document.getElementById('career-id').value = career.id;
                        document.getElementById('career-name').value = career.name;
                        document.getElementById('career-semesters').value = career.semesters;
                    } else {
                        document.getElementById('career-modal-title').textContent = 'Nueva Carrera';
                    }
                    modal.classList.add('show');
                },
                handleCareerSubmit: async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('career-id').value;
                    const name = document.getElementById('career-name').value;
                    const semesters = parseInt(document.getElementById('career-semesters').value);
                    const data = { name, semesters };

                    try {
                        if (id) {
                            await updateDoc(doc(db, "careers", id), data);
                            alert('Carrera actualizada.');
                        } else {
                            await setDoc(doc(collection(db, "careers")), data);
                            alert('Carrera creada.');
                        }
                        document.getElementById('career-modal').classList.remove('show');
                        Modules['plan-de-estudio'].renderCareersTable();
                    } catch (error) {
                        console.error("Error al guardar carrera:", error);
                        alert('Error al guardar la carrera.');
                    }
                },
                deleteCareer: async (id, name) => {
                    if (confirm(`¿Está seguro de que desea eliminar la carrera "${name}"?`)) {
                        try {
                            await deleteDoc(doc(db, "careers", id));
                            alert('Carrera eliminada.');
                            Modules['plan-de-estudio'].renderCareersTable();
                        } catch (error) {
                            console.error("Error al eliminar carrera:", error);
                            alert('Error al eliminar la carrera.');
                        }
                    }
                },

                // --- Gestión de Materias ---
                renderSubjectsTable: async () => {
                    const tableBody = document.getElementById('subjects-table')?.querySelector('tbody');
                    if (!tableBody) return;
                    tableBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
                    try {
                        const querySnapshot = await getDocs(collection(db, "subjects"));
                        tableBody.innerHTML = '';
                        if (querySnapshot.empty) {
                            tableBody.innerHTML = '<tr><td colspan="4">No hay materias registradas.</td></tr>';
                            return;
                        }
                        querySnapshot.forEach(doc => {
                            const subjectData = doc.data();
                            const subject = { id: doc.id, ...subjectData };
                            const row = document.createElement('tr');

                            // Generar una vista previa de los alias por carrera
                            let aliasesPreview = '';
                            if (subject.careerAliases && Object.keys(subject.careerAliases).length > 0) {
                                // Esta es una forma simplificada. Una implementación más robusta necesitaría
                                // buscar el nombre de la carrera por su ID. Por ahora, es una buena aproximación.
                                aliasesPreview = Object.values(subject.careerAliases).join(', ');
                            }

                            row.innerHTML = `
                                <td>${subject.name}</td>
                                <td>${aliasesPreview}</td>
                                <td>${subject.hours.theoretical}/${subject.hours.practical}/${subject.hours.total}</td>
                                <td>
                                    <button class="btn btn-warning btn-sm btn-edit-subject">✏️</button>
                                    <button class="btn btn-danger btn-sm btn-delete-subject">🗑️</button>
                                </td>
                            `;
                            row.querySelector('.btn-edit-subject').addEventListener('click', () => Modules['plan-de-estudio'].openSubjectModal(subject));
                            row.querySelector('.btn-delete-subject').addEventListener('click', () => Modules['plan-de-estudio'].deleteSubject(subject.id, subject.name));
                            tableBody.appendChild(row);
                        });
                    } catch (error) {
                        console.error("Error al cargar materias:", error);
                        tableBody.innerHTML = '<tr><td colspan="4" style="color:red;">Error al cargar materias.</td></tr>';
                    }
                },
                openSubjectModal: async (subject = null) => {
                    const modal = document.getElementById('subject-modal');
                    const form = document.getElementById('subject-form');
                    const aliasesContainer = document.getElementById('subject-aliases-container');
                    const aliasesSection = document.getElementById('aliases-section');
                    const hasAliasesCheckbox = document.getElementById('has-aliases-checkbox');

                    form.reset();
                    aliasesContainer.innerHTML = '<p>Cargando carreras...</p>';
                    aliasesSection.style.display = 'none'; // Ocultar por defecto
                    hasAliasesCheckbox.checked = false;
                    modal.classList.add('show');

                    // Listener para mostrar/ocultar la sección de alias
                    hasAliasesCheckbox.onchange = () => {
                        aliasesSection.style.display = hasAliasesCheckbox.checked ? 'block' : 'none';
                    };

                    // Cargar carreras para la gestión de alias
                    const careersSnapshot = await getDocs(collection(db, "careers"));
                    let aliasesHTML = '';
                    careersSnapshot.forEach(doc => {
                        const career = { id: doc.id, ...doc.data() };
                        aliasesHTML += `
                            <div class="form-row" style="align-items: center;">
                                <label class="form-group" style="flex: 1;">${career.name}</label>
                                <div class="form-group" style="flex: 2;">
                                    <input type="text" class="form-control alias-input" data-career-id="${career.id}" placeholder="Alias para esta carrera (opcional)">
                                </div>
                            </div>
                        `;
                    });
                    aliasesContainer.innerHTML = aliasesHTML;

                    // Si estamos editando, rellenar los campos
                    if (subject) {
                        document.getElementById('subject-modal-title').textContent = 'Editar Materia';
                        document.getElementById('subject-id').value = subject.id;
                        document.getElementById('subject-name').value = subject.name;
                        document.getElementById('subject-hours-theoretical').value = subject.hours.theoretical;
                        document.getElementById('subject-semester').value = subject.semester;
                        document.getElementById('subject-hours-practical').value = subject.hours.practical;
                        document.getElementById('subject-hours-total').value = subject.hours.total;

                        // Rellenar los alias existentes
                        if (subject.careerAliases && Object.keys(subject.careerAliases).length > 0) {
                            hasAliasesCheckbox.checked = true;
                            aliasesSection.style.display = 'block';
                            Object.keys(subject.careerAliases).forEach(careerId => {
                                const input = aliasesContainer.querySelector(`.alias-input[data-career-id="${careerId}"]`);
                                if (input) input.value = subject.careerAliases[careerId];
                            });
                        } else {
                            hasAliasesCheckbox.checked = false;
                        }
                    } else {
                        document.getElementById('subject-modal-title').textContent = 'Nueva Materia';
                    }
                },
                handleSubjectSubmit: async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('subject-id').value;
                    const name = document.getElementById('subject-name').value;
                    const semester = parseInt(document.getElementById('subject-semester').value);
                    const theoretical = parseInt(document.getElementById('subject-hours-theoretical').value);
                    const practical = parseInt(document.getElementById('subject-hours-practical').value);
                    const total = parseInt(document.getElementById('subject-hours-total').value);

                    // Recolectar los alias
                    let careerAliases = {};
                    const hasAliases = document.getElementById('has-aliases-checkbox').checked;
                    if (hasAliases) {
                        document.querySelectorAll('#subject-aliases-container .alias-input').forEach(input => {
                            if (input.value.trim()) {
                                careerAliases[input.dataset.careerId] = input.value.trim();
                            }
                        });
                    }

                    const data = {
                        name,
                        semester,
                        hours: { theoretical, practical, total },
                        careerAliases // Nueva estructura de alias
                    };

                    try {
                        if (id) {
                            await updateDoc(doc(db, "subjects", id), data);
                            alert('Materia actualizada.');
                        } else {
                            await setDoc(doc(collection(db, "subjects")), data);
                            alert('Materia creada.');
                        }
                        document.getElementById('subject-modal').classList.remove('show');
                        Modules['plan-de-estudio'].renderSubjectsTable();
                    } catch (error) {
                        console.error("Error al guardar materia:", error);
                        alert('Error al guardar la materia.');
                    }
                },
                deleteSubject: async (id, name) => {
                    if (confirm(`¿Está seguro de que desea eliminar la materia "${name}"?`)) {
                        try {
                            await deleteDoc(doc(db, "subjects", id));
                            alert('Materia eliminada.');
                            Modules['plan-de-estudio'].renderSubjectsTable();
                        } catch (error) {
                            console.error("Error al eliminar materia:", error);
                            alert('Error al eliminar la materia.');
                        }
                    }
                },
                // --- Gestión de Malla Curricular ---
                openCurriculumModal: async (career) => {
                    const modal = document.getElementById('curriculum-modal');
                    const container = document.getElementById('curriculum-semesters-container');
                    
                    document.getElementById('curriculum-modal-title').textContent = `Malla Curricular - ${career.name}`;
                    document.getElementById('curriculum-career-id').value = career.id;
                    container.innerHTML = '<p>Cargando malla...</p>';
                    modal.classList.add('show');

                    try {
                        // 1. Obtener todas las materias disponibles
                        const subjectsSnapshot = await getDocs(collection(db, "subjects"));
                        const allSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                        // 2. Obtener la carrera actualizada con su malla
                        const careerDoc = await getDoc(doc(db, "careers", career.id));
                        const currentCareer = careerDoc.data();
                        const curriculum = currentCareer.curriculum || {};

                        // 3. Generar los bloques de semestre
                        let semestersHTML = '';
                        for (let i = 1; i <= career.semesters; i++) {
                            semestersHTML += `
                                <div class="semester-block card">
                                    <div class="card-header">
                                        <span>Semestre ${i}</span>
                                        <button type="button" class="btn btn-success btn-sm btn-add-subject-to-semester">Añadir Materia</button>
                                    </div>
                                    <div class="card-body semester-subjects-list" data-semester-number="${i}">
                                        ${(curriculum[i] || []).map(subjectId => {
                                            const subject = allSubjects.find(s => s.id === subjectId);
                                            const displayName = subject?.careerAliases?.[career.id] || subject?.name;
                                            return subject ? `<div class="curriculum-subject-item" data-subject-id="${subject.id}">
                                                <span>${displayName}</span>
                                                <button type="button" class="btn btn-danger btn-sm btn-remove-subject">X</button>
                                            </div>` : '';
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        container.innerHTML = semestersHTML;

                        // 4. Añadir listeners a los botones
                        container.querySelectorAll('.btn-add-subject-to-semester').forEach(button => {
                            button.addEventListener('click', (e) => Modules['plan-de-estudio'].showSubjectAdder(e.target, allSubjects, career.id));
                        });
                        container.querySelectorAll('.btn-remove-subject').forEach(button => {
                            button.addEventListener('click', (e) => e.target.closest('.curriculum-subject-item').remove());
                        });

                    } catch (error) {
                        console.error("Error al abrir la malla curricular:", error);
                        container.innerHTML = '<p style="color:red;">Error al cargar la malla.</p>';
                    }
                },
                showSubjectAdder: (button, allSubjects, careerId) => {
                    // Cerrar otros dropdowns abiertos
                    document.querySelectorAll('.subject-adder-dropdown').forEach(d => d.remove());

                    const semesterBlock = button.closest('.semester-block');
                    const semesterList = semesterBlock.querySelector('.semester-subjects-list');
                    const semesterNumber = parseInt(semesterList.dataset.semesterNumber);
                    const assignedSubjectIds = Array.from(document.querySelectorAll('.curriculum-subject-item')).map(item => item.dataset.subjectId);

                    const availableSubjects = allSubjects.filter(s => !assignedSubjectIds.includes(s.id) && s.semester === semesterNumber);

                    const dropdown = document.createElement('div');
                    dropdown.className = 'subject-adder-dropdown';

                    if (availableSubjects.length > 0) {
                        availableSubjects.forEach(subject => {
                            const displayName = subject.careerAliases?.[careerId] || subject.name;
                            const div = document.createElement('div');
                            div.innerHTML = `${displayName} <small style="color: #888;">(${subject.name})</small>`;
                            div.dataset.subjectId = subject.id;
                            div.onclick = () => {
                                const newItem = document.createElement('div');
                                newItem.className = 'curriculum-subject-item';
                                newItem.dataset.subjectId = subject.id;
                                const finalDisplayName = subject.careerAliases?.[careerId] || subject.name;
                                newItem.innerHTML = `
                                    <span>${finalDisplayName}</span>
                                    <button type="button" class="btn btn-danger btn-sm btn-remove-subject">X</button>
                                `;
                                newItem.querySelector('.btn-remove-subject').addEventListener('click', (e) => e.target.closest('.curriculum-subject-item').remove());
                                semesterList.appendChild(newItem);
                                dropdown.remove();
                            };
                            dropdown.appendChild(div);
                        });
                    } else {
                        dropdown.innerHTML = '<div>No hay más materias disponibles.</div>';
                    }

                    semesterBlock.querySelector('.card-header').appendChild(dropdown);

                    // Clic fuera para cerrar
                    setTimeout(() => {
                        document.addEventListener('click', (e) => {
                            if (!dropdown.contains(e.target) && e.target !== button) {
                                dropdown.remove();
                            }
                        }, { once: true });
                    }, 0);
                },
                handleCurriculumSubmit: async (e) => {
                    e.preventDefault();
                    const careerId = document.getElementById('curriculum-career-id').value;
                    const newCurriculum = {};

                    document.querySelectorAll('.semester-subjects-list').forEach(list => {
                        const semesterNumber = list.dataset.semesterNumber;
                        const subjectIds = Array.from(list.querySelectorAll('.curriculum-subject-item')).map(item => item.dataset.subjectId);
                        if (subjectIds.length > 0) {
                            newCurriculum[semesterNumber] = subjectIds;
                        }
                    });

                    try {
                        const careerRef = doc(db, "careers", careerId);
                        await updateDoc(careerRef, { curriculum: newCurriculum });
                        alert('Malla curricular actualizada exitosamente.');
                        document.getElementById('curriculum-modal').classList.remove('show');
                    } catch (error) {
                        console.error("Error al guardar la malla curricular:", error);
                        alert('Error al guardar los cambios.');
                    }
                },
            },
            disponibilidad: {
                init: () => {
                    console.log('Módulo de Disponibilidad inicializado');
                    const form = document.getElementById('availability-form');
                    const role = Auth.getRole();

                    // Poblar los selectores de hora del formulario de creación
                    const startSelect = document.getElementById('avail-start-time');
                    const endSelect = document.getElementById('avail-end-time');
                    if (startSelect && endSelect) {
                        let currentTime = new Date();
                        currentTime.setHours(7, 0, 0, 0);
                        const finalTime = new Date();
                        finalTime.setHours(22, 0, 0, 0);

                        while (currentTime <= finalTime) {
                            const h = String(currentTime.getHours()).padStart(2, '0');
                            const m = String(currentTime.getMinutes()).padStart(2, '0');
                            const timeSlot = `${h}:${m}`;
                            startSelect.innerHTML += `<option value="${timeSlot}">${timeSlot}</option>`;
                            endSelect.innerHTML += `<option value="${timeSlot}">${timeSlot}</option>`;
                            currentTime.setMinutes(currentTime.getMinutes() + 45);
                        }
                    }

                    // El formulario de creación solo es visible para profesores y admins/directores
                    if (form && (role === 'profesor' || role === 'admin' || role === 'director')) {
                        form.addEventListener('submit', Modules.disponibilidad.handleAvailabilitySubmit);
                    } else if (form) {
                        form.style.display = 'none'; // Ocultar si no tiene permisos
                    }

                    const editForm = document.getElementById('availability-edit-form');
                    if (editForm) {
                        editForm.addEventListener('submit', Modules.disponibilidad.handleUpdateAvailability);
                        document.getElementById('delete-avail-btn').addEventListener('click', () => Modules.disponibilidad.handleDeleteAvailability());

                    } else {
                        console.warn('El formulario de disponibilidad no se encontró.');
                    }

                    // Configurar el filtro solo para admin/director
                    if (role === 'admin' || role === 'director') {
                        Modules.disponibilidad.setupProfessorFilter();
                    }

                    Modules.disponibilidad.renderAvailabilityGrid();
                    Modules.disponibilidad.setupAvailabilityForm();
                },
                handleAvailabilitySubmit: async (e) => {
                    e.preventDefault();
                    const day = document.getElementById('avail-day').value;
                    const startTime = document.getElementById('avail-start-time').value;
                    const endTime = document.getElementById('avail-end-time').value;
                    const subjectId = document.getElementById('avail-materia').value;

                    if (!day || !startTime || !endTime || !subjectId) {
                        alert('Todos los campos son obligatorios.');
                        return;
                    }

                    // Validación para que la hora de fin no sea anterior o igual a la de inicio
                    if (endTime <= startTime) {
                        alert('Error: La hora de fin no puede ser anterior o igual a la hora de inicio.');
                        return;
                    }

                    const role = Auth.getRole();
                    let teacherUid, teacherName;

                    if (role === 'profesor') {
                        teacherUid = Auth.currentUser.uid;
                        teacherName = Auth.currentUser.nombre;
                    } else { // Admin o Director
                        const select = document.getElementById('professor-filter-select');
                        teacherUid = select.value;
                        teacherName = select.options[select.selectedIndex].text;
                    }

                    const availabilityData = {
                        teacherUid,
                        teacherName,
                        day,
                        startTime,
                        endTime,
                        subjectId // Guardamos el ID de la materia, no su nombre
                    };

                    try {
                        // Usamos un ID autogenerado por Firestore
                        const docRef = doc(collection(db, "teacherAvailability"));
                        await setDoc(docRef, availabilityData);
                        alert('Disponibilidad guardada exitosamente.');
                        document.getElementById('availability-form').reset();
                        Modules.disponibilidad.renderAvailabilityGrid(); // Refrescar el horario
                    } catch (error) {
                        console.error("Error al guardar la disponibilidad:", error);
                        alert(`Error al guardar: ${error.message}`);
                    }
                },
                openAvailabilityEditModal: async (availData) => {
                    const modal = document.getElementById('availability-edit-modal');
                    const startSelect = document.getElementById('edit-avail-start-time');
                    const endSelect = document.getElementById('edit-avail-end-time');

                    // Limpiar y poblar los selectores de hora con formato académico
                    startSelect.innerHTML = '';
                    endSelect.innerHTML = '';
                    let currentTime = new Date();
                    currentTime.setHours(7, 0, 0, 0);
                    const finalTime = new Date();
                    finalTime.setHours(22, 0, 0, 0); // Hasta las 10 PM para la hora de fin

                    while (currentTime <= finalTime) {
                        const h = String(currentTime.getHours()).padStart(2, '0');
                        const m = String(currentTime.getMinutes()).padStart(2, '0');
                        const timeSlot = `${h}:${m}`;
                        startSelect.innerHTML += `<option value="${timeSlot}">${timeSlot}</option>`;
                        endSelect.innerHTML += `<option value="${timeSlot}">${timeSlot}</option>`;
                        currentTime.setMinutes(currentTime.getMinutes() + 45);
                    }

                    // Rellenar el modal con los datos actuales
                    document.getElementById('edit-avail-id').value = availData.id;
                    document.getElementById('edit-avail-day').value = availData.day;

                    // Buscar y mostrar el nombre completo de la materia
                    const subjectP = document.getElementById('edit-avail-subject');
                    subjectP.textContent = 'Cargando materia...';
                    try {
                        const subjectDoc = await getDoc(doc(db, "subjects", availData.subjectId));
                        if (subjectDoc.exists()) {
                            const subjectInfo = subjectDoc.data();
                            let fullSubjectName = subjectInfo.name;
                            if (subjectInfo.careerAliases) {
                                const aliases = Object.values(subjectInfo.careerAliases).filter(alias => alias !== subjectInfo.name);
                                if (aliases.length > 0) {
                                    fullSubjectName += ` / ${[...new Set(aliases)].join(' / ')}`;
                                }
                            }
                            subjectP.textContent = fullSubjectName;
                        } else {
                            subjectP.textContent = 'Materia Desconocida';
                        }
                    } catch (error) {
                        console.error("Error al cargar la materia en el modal:", error);
                        subjectP.textContent = 'Error al cargar';
                    }

                    startSelect.value = availData.startTime;
                    endSelect.value = availData.endTime;
                    modal.classList.add('show');
                },
                handleUpdateAvailability: async (e) => {
                    e.preventDefault();
                    const availabilityId = document.getElementById('edit-avail-id').value;
                    const newDay = document.getElementById('edit-avail-day').value;
                    const newStartTime = document.getElementById('edit-avail-start-time').value;
                    const newEndTime = document.getElementById('edit-avail-end-time').value;

                    try {
                        const docRef = doc(db, "teacherAvailability", availabilityId);
                        await updateDoc(docRef, {
                            day: newDay,
                            startTime: newStartTime,
                            endTime: newEndTime
                        });
                        alert('Disponibilidad actualizada exitosamente.');
                        document.getElementById('availability-edit-modal').classList.remove('show');
                        Modules.disponibilidad.renderAvailabilityGrid();
                    } catch (error) {
                        console.error("Error al actualizar la disponibilidad:", error);
                        alert(`Error al actualizar: ${error.message}`);
                    }
                },
                handleDeleteAvailability: async () => {
                    const availabilityId = document.getElementById('edit-avail-id').value;
                    const subject = document.getElementById('edit-avail-subject').textContent;

                    if (confirm(`¿Está seguro de que desea eliminar la disponibilidad para "${subject}"? Esta acción no se puede deshacer.`)) {
                        try {
                            const docRef = doc(db, "teacherAvailability", availabilityId);
                            await deleteDoc(docRef);
                            alert('Disponibilidad eliminada exitosamente.');
                            document.getElementById('availability-edit-modal').classList.remove('show');
                            Modules.disponibilidad.renderAvailabilityGrid(); // Refrescar el horario
                        } catch (error) {
                            console.error("Error al eliminar la disponibilidad:", error);
                            alert(`Error al eliminar: ${error.message}`);
                        }
                    }
                },
                setupProfessorFilter: async () => {
                    const filterContainer = document.getElementById('availability-filter-container');
                    const select = document.getElementById('professor-filter-select');
                    if (!filterContainer || !select) return;

                    try {
                        const usersRef = collection(db, "users");
                        const q = query(usersRef, where("rol", "==", "profesor"));
                        const querySnapshot = await getDocs(q);

                        select.innerHTML = '<option value="all">-- Todos los Profesores --</option>';
                        querySnapshot.forEach(doc => {
                            select.innerHTML += `<option value="${doc.id}">${doc.data().nombre}</option>`;
                        });

                        select.addEventListener('change', () => Modules.disponibilidad.renderAvailabilityGrid());
                        filterContainer.style.display = 'block';

                    } catch (error) {
                        console.error("Error al cargar la lista de profesores:", error);
                        filterContainer.innerHTML = '<p style="color:red;">No se pudo cargar el filtro de profesores.</p>';
                    }
                },
                setupAvailabilityForm: async () => {
                    const careerSelect = document.getElementById('avail-carrera');
                    const semesterGroup = document.getElementById('semestre-group');
                    const semesterSelect = document.getElementById('avail-semestre');
                    const subjectGroup = document.getElementById('materia-group');
                    const subjectSelect = document.getElementById('avail-materia');

                    if (!careerSelect) return;

                    try {
                        // 1. Cargar Carreras
                        const careersSnapshot = await getDocs(collection(db, "careers"));
                        careersSnapshot.forEach(doc => {
                            careerSelect.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
                        });

                        // 2. Listener para cambio de Carrera
                        careerSelect.addEventListener('change', async (e) => {
                            const careerId = e.target.value;
                            semesterGroup.style.display = 'none';
                            subjectGroup.style.display = 'none';
                            semesterSelect.innerHTML = '';
                            subjectSelect.innerHTML = '';

                            if (!careerId) return;

                            const careerDoc = await getDoc(doc(db, "careers", careerId));
                            if (!careerDoc.exists()) return;

                            const careerData = careerDoc.data();
                            semesterSelect.innerHTML = '<option value="">Seleccione un semestre</option>';
                            for (let i = 1; i <= careerData.semesters; i++) {
                                semesterSelect.innerHTML += `<option value="${i}">Semestre ${i}</option>`;
                            }
                            semesterGroup.style.display = 'block';
                        });

                        // 3. Listener para cambio de Semestre
                        semesterSelect.addEventListener('change', async (e) => {
                            const semester = e.target.value;
                            const careerId = careerSelect.value;
                            subjectGroup.style.display = 'none';
                            subjectSelect.innerHTML = '';

                            if (!semester || !careerId) return;

                            const careerDoc = await getDoc(doc(db, "careers", careerId));
                            const curriculum = careerDoc.data().curriculum || {};
                            const subjectIds = curriculum[semester] || [];

                            subjectSelect.innerHTML = '<option value="">Seleccione una materia</option>';
                            for (const subjectId of subjectIds) {
                                const subjectDoc = await getDoc(doc(db, "subjects", subjectId));
                                if (subjectDoc.exists()) {
                                    const subjectData = subjectDoc.data();
                                    const displayName = subjectData.careerAliases?.[careerId] || subjectData.name;
                                    subjectSelect.innerHTML += `<option value="${subjectDoc.id}">${displayName}</option>`;
                                }
                            }
                            subjectGroup.style.display = 'block';
                        });

                    } catch (error) {
                        console.error("Error al configurar el formulario de disponibilidad:", error);
                        careerSelect.innerHTML = '<option value="">Error al cargar carreras</option>';
                    }
                },
                renderAvailabilityGrid: async () => {
                    const container = document.getElementById('availability-grid-container');
                    if (!container) return;

                    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    // Generamos los bloques horarios de 45 minutos
                    const hours = [];
                    let currentTime = new Date();
                    currentTime.setHours(7, 0, 0, 0); // Start at 7:00 AM
                    const endTime = new Date();
                    endTime.setHours(21, 0, 0, 0); // End at 9:00 PM

                    while (currentTime <= endTime) {
                        const h = String(currentTime.getHours()).padStart(2, '0');
                        const m = String(currentTime.getMinutes()).padStart(2, '0');
                        hours.push(`${h}:${m}`);
                        currentTime.setMinutes(currentTime.getMinutes() + 45);
                    }

                    let gridHTML = '<div class="schedule-grid">';
                    // Cabecera de días
                    gridHTML += '<div class="schedule-header">Hora</div>';
                    days.forEach(day => gridHTML += `<div class="schedule-header">${day}</div>`);

                    // Filas de horas y celdas
                    hours.forEach(hour => {
                        gridHTML += `<div class="schedule-time">${hour}</div>`;
                        days.forEach(day => {
                            gridHTML += `<div class="schedule-slot" data-day="${day}" data-hour="${hour}"></div>`;
                        });
                    });
                    gridHTML += '</div>';
                    container.innerHTML = gridHTML;

                    // Ahora, obtenemos los datos y los pintamos en la grilla
                    const availabilityRef = collection(db, "teacherAvailability");
                    let availabilityQuery;
                    const role = Auth.getRole();

                    // Si el rol es profesor, solo busca su propia disponibilidad.
                    // Si es admin/director, busca todas.
                    if (role === 'profesor') {
                        availabilityQuery = query(availabilityRef, where("teacherUid", "==", Auth.currentUser.uid));
                    } else if (role === 'admin' || role === 'director') {
                        const selectedTeacherUid = document.getElementById('professor-filter-select')?.value;
                        if (selectedTeacherUid && selectedTeacherUid !== 'all') {
                            availabilityQuery = query(availabilityRef, where("teacherUid", "==", selectedTeacherUid));
                        } else {
                            availabilityQuery = query(availabilityRef); // Admins/directores ven todo si no hay filtro
                        }
                    } else {
                        availabilityQuery = query(availabilityRef, where("teacherUid", "==", "INVALID_UID")); // No mostrar nada si no tiene rol
                    }

                    try {
                        const querySnapshot = await getDocs(availabilityQuery);
                        // Para optimizar, cargamos todas las materias una sola vez
                        const subjectsSnapshot = await getDocs(collection(db, "subjects"));
                        const allSubjects = {};
                        subjectsSnapshot.forEach(doc => {
                            allSubjects[doc.id] = doc.data();
                        });

                        const isAllProfessorsView = document.getElementById('professor-filter-select')?.value === 'all';
                        querySnapshot.forEach((doc) => {
                            const avail = doc.data();

                            const [startH, startM] = avail.startTime.split(':').map(Number);
                            const availStartMinutes = startH * 60 + startM;
                            const [endH, endM] = avail.endTime.split(':').map(Number);
                            const availEndMinutes = endH * 60 + endM;

                            // Iterar sobre los bloques de 45 minutos y ver cuáles caen en el rango
                            hours.forEach(hourSlot => {
                                const [slotH, slotM] = hourSlot.split(':').map(Number);
                                const slotStartMinutes = slotH * 60 + slotM;

                                if (slotStartMinutes >= availStartMinutes && slotStartMinutes < availEndMinutes) {
                                    const slot = container.querySelector(`.schedule-slot[data-day="${avail.day}"][data-hour="${hourSlot}"]`);
                                if (slot) {
                                    const item = document.createElement('div');
                                    item.className = 'schedule-entry';

                                    // Construir el nombre completo de la materia (principal + alias)
                                    const subjectInfo = allSubjects[avail.subjectId];
                                    let fullSubjectName = subjectInfo ? subjectInfo.name : 'Materia Desconocida';
                                    if (subjectInfo && subjectInfo.careerAliases) {
                                        const aliases = Object.values(subjectInfo.careerAliases).filter(alias => alias !== subjectInfo.name);
                                        if (aliases.length > 0) {
                                            fullSubjectName += ` - ${[...new Set(aliases)].join(' - ')}`;
                                        }
                                    }

                                    // Si es la vista de "Todos", mostrar también el nombre del profesor
                                    if (isAllProfessorsView) {
                                        item.innerHTML = `<strong>${fullSubjectName}</strong><br><small>${avail.teacherName}</small>`;
                                    } else {
                                        item.textContent = fullSubjectName;
                                    }
                                    // Profesores pueden modificar lo suyo, admins/directores pueden modificar todo
                                    if (Auth.getRole() === 'profesor' || Auth.getRole() === 'admin' || Auth.getRole() === 'director') {
                                        item.addEventListener('click', () => Modules.disponibilidad.openAvailabilityEditModal({ id: doc.id, ...avail }));
                                    }
                                    item.title = `Prof: ${avail.teacherName}`;
                                    slot.appendChild(item);
                                }
                            }
                            });
                        });
                    } catch (error) {
                        console.error("Error al cargar la disponibilidad en el horario:", error);
                    }
                }
            }
        };
        
        // Inicialización de la aplicación
        App.init();
    });
