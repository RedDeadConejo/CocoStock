/**
 * Página Settings
 * Panel de configuración para administradores
 * Permite gestionar roles, usuarios y permisos
 */

import { useState, useEffect, useRef } from 'react';
import { 
  getAllRoles, 
  createRole, 
  updateRole, 
  deleteRole,
  getAllUsersSimple,
  getAllUsersWithAuth,
  createUser,
  updateUserRole,
  updateUserProfile,
  deleteUser,
  getAvailablePermissions
} from '../../services/roleManagement';
import { 
  getRestaurants, 
  createRestaurant, 
  updateRestaurant, 
  deleteRestaurant,
  assignRestaurantToUser
} from '../../services/restaurants';
import {
  getAuthorizedIps,
  createAuthorizedIp,
  updateAuthorizedIp,
  deleteAuthorizedIp,
} from '../../services/authorizedIps';
import {
  getMinimumVersion,
  updateMinimumVersion,
  getAppReleases,
  createAppRelease,
  deactivateAppRelease,
  activateAppRelease,
  PLATFORM_OPTIONS,
} from '../../services/appReleases';
import { startLocalServer, stopLocalServer, getServerStatus } from '../../services/localServer';
import { registerMermaServerToken, unregisterMermaServerToken } from '../../services/merma';
import { useRole, clearRoleCache } from '../../hooks/useRole';
import { supabase } from '../../services/supabase';
import './Settings.css';

const LOCAL_SERVERS_STORAGE_KEY = 'cocostock_local_servers';

async function loadLocalServersFromStorage() {
  try {
    const { getItem } = await import('../../utils/secureStorage');
    const stored = await getItem(LOCAL_SERVERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_SERVERS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('Error al cargar servidores locales:', e);
  }
  return [];
}

async function saveLocalServersToStorage(list) {
  try {
    const { setItem } = await import('../../utils/secureStorage');
    await setItem(LOCAL_SERVERS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error al guardar servidores locales:', e);
  }
}

function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI;
}

function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const { roleName, loading: roleLoading, permissions } = useRole(currentUser?.id);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof sessionStorage === 'undefined') return 'roles';
    const openTab = sessionStorage.getItem('settingsOpenTab');
    if (openTab && ['roles', 'users', 'restaurants', 'authorized-ips', 'local-servers', 'app-releases'].includes(openTab)) return openTab;
    return 'roles';
  });
  
  // Estados para roles
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({
    role_name: '',
    description: '',
    permissions: {}
  });
  
  // Estados para usuarios
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userRoleUpdates, setUserRoleUpdates] = useState({});
  const [userRestaurantUpdates, setUserRestaurantUpdates] = useState({});
  const [userProfileUpdates, setUserProfileUpdates] = useState({}); // { userId: { full_name, phone } }
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role_name: '',
    restaurant_id: '',
    full_name: '',
    phone: ''
  });
  
  // Estados para restaurantes
  const [restaurants, setRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [restaurantFormData, setRestaurantFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    notas: ''
  });
  
  // Estados para IPs autorizadas
  const [authorizedIps, setAuthorizedIps] = useState([]);
  const [loadingIps, setLoadingIps] = useState(true);
  const [showIpForm, setShowIpForm] = useState(false);
  const [editingIp, setEditingIp] = useState(null);
  const [ipFormData, setIpFormData] = useState({
    ip_address: '',
    description: '',
    activo: true,
  });

  // Estados para Servidores locales (solo en Electron, con sesión; datos cifrados en local)
  const [localServersList, setLocalServersList] = useState([]);
  const [localServersLoaded, setLocalServersLoaded] = useState(false);
  const [serverStatus, setServerStatus] = useState({ running: false, servers: [] });
  const [serverError, setServerError] = useState('');
  const [serverLoading, setServerLoading] = useState(false);
  const [showServerForm, setShowServerForm] = useState(false);
  const [serverFormData, setServerFormData] = useState({
    name: '',
    port: '8080',
    mode: 'merma', // 'merma' | 'full'
    restaurantId: '', // obligatorio para modo merma
  });
  const [runningMermaTokens, setRunningMermaTokens] = useState([]); // tokens a desregistrar al parar

  // Releases: desbloqueado solo con el atajo (5 clics en el título en 3 s)
  const [appReleasesUnlocked, setAppReleasesUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('settingsAppReleasesUnlocked') === '1';
    } catch { return false; }
  });
  const [releasesSecretClicks, setReleasesSecretClicks] = useState(0);
  const releasesSecretTimerRef = useRef(null);

  // Estados para Releases de la app (solo admin, oculto)
  const [minimumVersion, setMinimumVersion] = useState(null);
  const [loadingMinVersion, setLoadingMinVersion] = useState(false);
  const [appReleases, setAppReleases] = useState([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [uploadingRelease, setUploadingRelease] = useState(false);
  const [releaseFormData, setReleaseFormData] = useState({
    version: '',
    platform: 'win32',
    file: null,
    releaseNotes: '',
  });
  
  // Estados generales
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availablePermissions = getAvailablePermissions();

  useEffect(() => {
    loadLocalServersFromStorage().then((list) => {
      setLocalServersList(list);
      setLocalServersLoaded(true);
    });
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      // Log de depuración
      if (user) {
        console.log('[Settings] Usuario actual:', {
          id: user.id,
          email: user.email
        });
      }
    };
    getUser();
  }, []);
  
  // Verificar y corregir el rol automáticamente cuando se detecta una discrepancia
  useEffect(() => {
    if (!currentUser?.id) return;
    
    // Solo verificar si el rol ya está cargado
    if (!roleName) return;
    
    let isMounted = true;
    let verificationInProgress = false;
    let verificationCount = 0;
    const MAX_VERIFICATIONS = 3; // Limitar verificaciones para evitar bucles
    
    const verifyRole = async () => {
      // Evitar múltiples verificaciones simultáneas y bucles infinitos
      if (verificationInProgress || verificationCount >= MAX_VERIFICATIONS) {
        if (verificationCount >= MAX_VERIFICATIONS) {
          console.warn('[Settings] Máximo de verificaciones alcanzado, deteniendo...');
        }
        return;
      }
      verificationInProgress = true;
      verificationCount++;
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('role_name')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        if (!isMounted) {
          verificationInProgress = false;
          return;
        }
        
        if (error) {
          console.error('[Settings] Error al verificar rol en DB:', error);
          verificationInProgress = false;
          return;
        }
        
        if (profile) {
          const roleInDB = profile.role_name;
          const roleInState = roleName;
          
          console.log('[Settings] Verificación de rol (#', verificationCount, '):', {
            userId: currentUser.id,
            roleInDB,
            roleInState,
            match: roleInDB === roleInState,
            shouldBeAdmin: roleInDB === 'admin'
          });
          
          // Si el rol en DB es admin pero el estado tiene otro valor, limpiar cache inmediatamente
          if (roleInDB === 'admin' && roleInState !== 'admin') {
            console.error('[Settings] 🚨 DISCREPANCIA CRÍTICA: DB tiene admin pero estado tiene', roleInState);
            console.error('[Settings] Limpiando cache y forzando recarga del hook...');
            
            // Limpiar cache inmediatamente
            clearRoleCache(currentUser.id);
            
            // Disparar evento para que useRole se actualice
            window.dispatchEvent(new CustomEvent('forceRoleReload', { 
              detail: { userId: currentUser.id, expectedRole: 'admin' } 
            }));
            
            // También disparar roleUpdated para sincronizar
            window.dispatchEvent(new CustomEvent('roleUpdated', { 
              detail: { userId: currentUser.id, newRole: 'admin', oldRole: roleInState } 
            }));
          } else if (roleInDB !== 'admin' && roleInState === 'admin') {
            // Caso inverso: estado tiene admin pero DB no
            console.warn('[Settings] ⚠️ Discrepancia: estado tiene admin pero DB tiene', roleInDB);
            clearRoleCache(currentUser.id);
            window.dispatchEvent(new CustomEvent('forceRoleReload', { 
              detail: { userId: currentUser.id, expectedRole: roleInDB } 
            }));
          }
        } else {
          console.warn('[Settings] No se encontró perfil en DB para usuario:', currentUser.id);
        }
      } catch (err) {
        console.error('[Settings] Error al verificar rol:', err);
      } finally {
        verificationInProgress = false;
      }
    };
    
    // Verificar después de un pequeño delay para asegurar que el rol se haya cargado
    const timeout = setTimeout(verifyRole, 500);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [currentUser?.id, roleName]);

  // Cargar roles cuando el usuario puede ver la pestaña Roles
  useEffect(() => {
    if (roleName === 'admin' || permissions?.view_settings_roles === true) {
      loadRoles();
    }
  }, [roleName, permissions?.view_settings_roles]);

  // Cargar restaurantes cuando se necesiten (usuarios, restaurantes o servidores locales)
  useEffect(() => {
    const needRestaurants =
      activeTab === 'restaurants' || activeTab === 'users' || activeTab === 'local-servers';
    const canSeeAny = roleName === 'admin' ||
      permissions?.view_settings_restaurants === true ||
      permissions?.view_settings_users === true ||
      permissions?.view_settings_local_servers === true;
    if (needRestaurants && canSeeAny) {
      loadRestaurants();
    }
  }, [roleName, permissions, activeTab]);

  // Cargar IPs autorizadas cuando el usuario puede ver esa pestaña
  useEffect(() => {
    const canSeeIps = roleName === 'admin' || permissions?.view_settings_authorized_ips === true;
    if (canSeeIps && activeTab === 'authorized-ips') {
      loadAuthorizedIps();
    }
  }, [roleName, permissions?.view_settings_authorized_ips, activeTab]);

  // Persistir lista de servidores locales (cifrada)
  useEffect(() => {
    if (!localServersLoaded) return;
    saveLocalServersToStorage(localServersList);
  }, [localServersList, localServersLoaded]);

  // Estado de servidores locales (solo en Electron, pestaña activa)
  useEffect(() => {
    if (!isElectron() || activeTab !== 'local-servers') return;
    const check = async () => {
      const status = await getServerStatus();
      setServerStatus(status);
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Cargar usuarios cuando el usuario puede ver la pestaña Usuarios
  useEffect(() => {
    if ((roleName === 'admin' || permissions?.view_settings_users === true) && activeTab === 'users') {
      loadUsers();
    }
  }, [roleName, permissions?.view_settings_users, activeTab]);

  // Al abrir el formulario de nuevo usuario, asegurar un rol por defecto dinámico (primer rol de la lista)
  useEffect(() => {
    if (!showUserForm || roles.length === 0) return;
    const currentRole = userFormData.role_name;
    const roleExists = roles.some((r) => r.role_name === currentRole);
    if (currentRole === '' || !roleExists) {
      setUserFormData((prev) => ({ ...prev, role_name: roles[0].role_name }));
    }
  }, [showUserForm, roles]);

  // Si la pestaña activa no está permitida para el usuario, cambiar a la primera permitida
  useEffect(() => {
    const allowed = [
      (roleName === 'admin' || permissions?.view_settings_roles) && 'roles',
      (roleName === 'admin' || permissions?.view_settings_users) && 'users',
      (roleName === 'admin' || permissions?.view_settings_restaurants) && 'restaurants',
      (roleName === 'admin' || permissions?.view_settings_authorized_ips) && 'authorized-ips',
      (roleName === 'admin' || permissions?.view_settings_local_servers) && 'local-servers',
      roleName === 'admin' && 'app-releases', // Solo admin, oculto
    ].filter(Boolean);
    if (allowed.length && !allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  }, [roleName, permissions, activeTab]);

  // Cargar datos de app-releases cuando el admin abre la pestaña
  useEffect(() => {
    if (roleName !== 'admin' || activeTab !== 'app-releases') return;
    const load = async () => {
      setLoadingMinVersion(true);
      setLoadingReleases(true);
      try {
        const [minData, releases] = await Promise.all([getMinimumVersion(), getAppReleases()]);
        setMinimumVersion(minData?.minimum_version ?? '');
        setAppReleases(releases);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingMinVersion(false);
        setLoadingReleases(false);
      }
    };
    load();
  }, [roleName, activeTab]);

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);
      setError('');
      const data = await getAllRoles();
      setRoles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setError('');
      // Intentar usar la función RPC que incluye emails
      try {
        const data = await getAllUsersWithAuth();
        // Asegurarse de que todos los usuarios tengan restaurant_id
        // La función RPC ahora incluye restaurant_id, pero verificamos por si acaso
        const usersWithRestaurants = await Promise.all(
          data.map(async (user) => {
            // Asegurar que restaurant_id esté presente (puede ser null o undefined)
            const restaurantId = user.restaurant_id || null;
            
            // Log para depuración
            if (restaurantId) {
              console.log('[Settings] Usuario con restaurante:', {
                userId: user.id,
                restaurantId,
                restaurantIdType: typeof restaurantId
              });
            }
            
            // Si tiene restaurant_id, cargar información del restaurante
            if (restaurantId) {
              try {
                const allRestaurants = await getRestaurants();
                const restaurant = allRestaurants.find(r => {
                  // Comparar como strings para evitar problemas de tipo
                  return String(r.id) === String(restaurantId);
                });
                return { 
                  ...user, 
                  restaurant,
                  restaurant_id: restaurantId // Asegurar que restaurant_id esté presente
                };
              } catch (err) {
                console.warn('Error al cargar restaurante del usuario:', err);
                return { ...user, restaurant_id: restaurantId };
              }
            }
            return { ...user, restaurant_id: null };
          })
        );
        setUsers(usersWithRestaurants);
      } catch (rpcError) {
        // Si falla, usar la versión simple
        console.warn('No se pudo obtener usuarios con auth, usando versión simple:', rpcError);
        const data = await getAllUsersSimple();
        // Asegurarse de que restaurant_id esté presente en todos los usuarios
        const usersWithRestaurantId = data.map(user => ({
          ...user,
          restaurant_id: user.restaurant_id || null
        }));
        setUsers(usersWithRestaurantId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadRestaurants = async () => {
    try {
      setLoadingRestaurants(true);
      setError('');
      const data = await getRestaurants();
      setRestaurants(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const loadAuthorizedIps = async () => {
    try {
      setLoadingIps(true);
      setError('');
      const data = await getAuthorizedIps();
      setAuthorizedIps(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingIps(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!roleFormData.role_name.trim()) {
        setError('El nombre del rol es requerido');
        return;
      }

      await createRole(roleFormData);
      setSuccess('Rol creado exitosamente');
      closeRoleForm();
      loadRoles();
      window.dispatchEvent(new CustomEvent('viewPermissionsUpdated'));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateRole = async () => {
    try {
      setError('');
      setSuccess('');

      const newName = (roleFormData.role_name || '').trim();
      if (!newName) {
        setError('El nombre del rol es requerido');
        return;
      }

      await updateRole(editingRole.role_name, {
        role_name: newName,
        description: roleFormData.description,
        permissions: roleFormData.permissions
      });
      
      setSuccess('Rol actualizado exitosamente');
      closeRoleForm();
      loadRoles();
      window.dispatchEvent(new CustomEvent('viewPermissionsUpdated'));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRole = async (roleName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el rol "${roleName}"?`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      await deleteRole(roleName);
      setSuccess('Rol eliminado exitosamente');
      loadRoles();
      window.dispatchEvent(new CustomEvent('viewPermissionsUpdated'));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleFormData({
      role_name: role.role_name,
      description: role.description || '',
      permissions: role.permissions || {}
    });
    setShowRoleForm(true);
  };

  const handlePermissionToggle = (permissionKey) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: !prev.permissions[permissionKey]
      }
    }));
  };

  const handleUserRoleChange = (userId, newRole) => {
    setUserRoleUpdates(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleUserRestaurantChange = (userId, restaurantId) => {
    setUserRestaurantUpdates(prev => ({
      ...prev,
      [userId]: restaurantId || null
    }));
  };

  const handleUserProfileFieldChange = (userId, field, value) => {
    setUserProfileUpdates(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleSaveUserRoles = async () => {
    try {
      setError('');
      setSuccess('');
      
      // Combinar todas las actualizaciones de perfil
      const allUpdates = {};
      
      // Agregar actualizaciones de rol
      Object.entries(userRoleUpdates).forEach(([userId, newRole]) => {
        if (!allUpdates[userId]) allUpdates[userId] = {};
        allUpdates[userId].role_name = newRole;
      });
      
      // Agregar actualizaciones de restaurante
      Object.entries(userRestaurantUpdates).forEach(([userId, restaurantId]) => {
        if (!allUpdates[userId]) allUpdates[userId] = {};
        allUpdates[userId].restaurant_id = restaurantId;
      });
      
      // Agregar actualizaciones de otros campos del perfil
      Object.entries(userProfileUpdates).forEach(([userId, profileData]) => {
        if (!allUpdates[userId]) allUpdates[userId] = {};
        if (profileData.full_name !== undefined) allUpdates[userId].full_name = profileData.full_name;
        if (profileData.phone !== undefined) allUpdates[userId].phone = profileData.phone;
      });
      
      // Ejecutar todas las actualizaciones
      const updatePromises = Object.entries(allUpdates).map(([userId, updates]) =>
        updateUserProfile(userId, updates)
      );
      
      await Promise.all(updatePromises);
      setSuccess('Cambios guardados exitosamente');
      setUserRoleUpdates({});
      setUserRestaurantUpdates({});
      setUserProfileUpdates({});
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const closeRoleForm = () => {
    setShowRoleForm(false);
    setEditingRole(null);
    setRoleFormData({ role_name: '', description: '', permissions: {} });
  };

  const closeUserForm = () => {
    setShowUserForm(false);
    setUserFormData({
      email: '',
      password: '',
      confirmPassword: '',
      role_name: '',
      restaurant_id: '',
      full_name: '',
      phone: ''
    });
  };

  const closeRestaurantForm = () => {
    setShowRestaurantForm(false);
    setEditingRestaurant(null);
    setRestaurantFormData({ nombre: '', direccion: '', telefono: '', email: '', notas: '' });
  };

  const closeIpForm = () => {
    setShowIpForm(false);
    setEditingIp(null);
    setIpFormData({ ip_address: '', description: '', activo: true });
  };

  const closeServerForm = () => {
    setShowServerForm(false);
    setServerFormData({ name: '', port: '8080', mode: 'merma', restaurantId: '' });
  };

  const handleCreateUser = async () => {
    try {
      setError('');
      setSuccess('');
      if (!userFormData.email || !userFormData.password) {
        setError('El email y la contraseña son requeridos');
        return;
      }
      if (userFormData.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
      if (userFormData.password !== userFormData.confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
      if(!userFormData.role_name){
        setError('El rol es requerido');
        return;
      }
      if(userFormData.role_name !== 'admin' && !userFormData.restaurant_id){
        setError('El restaurante es requerido');
        return;
      }
      await createUser({
        email: userFormData.email,
        password: userFormData.password,
        role_name: userFormData.role_name,
        restaurant_id: userFormData.restaurant_id || null,
        full_name: userFormData.full_name || null,
        phone: userFormData.phone || null
      });
      setSuccess('Usuario creado exitosamente');
      closeUserForm();
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId, userEmailOrName) => {
    const label = userEmailOrName || userId?.substring(0, 8) + '...';
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${label}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }
    try {
      setError('');
      setSuccess('');
      await deleteUser(userId);
      setSuccess('Usuario eliminado correctamente');
      loadUsers();
    } catch (err) {
      setError(err.message || 'Error al eliminar el usuario');
    }
  };

  const handleCreateRestaurant = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!restaurantFormData.nombre.trim()) {
        setError('El nombre del restaurante es requerido');
        return;
      }

      await createRestaurant(restaurantFormData);
      setSuccess('Restaurante creado exitosamente');
      closeRestaurantForm();
      loadRestaurants();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateRestaurant = async () => {
    try {
      setError('');
      setSuccess('');

      await updateRestaurant(editingRestaurant.id, restaurantFormData);
      
      setSuccess('Restaurante actualizado exitosamente');
      closeRestaurantForm();
      loadRestaurants();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRestaurant = async (restaurantId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este restaurante?')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      await deleteRestaurant(restaurantId);
      setSuccess('Restaurante eliminado exitosamente');
      loadRestaurants();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateIp = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!ipFormData.ip_address.trim()) {
        setError('La dirección IP es requerida');
        return;
      }

      await createAuthorizedIp(ipFormData);
      setSuccess('IP autorizada creada exitosamente');
      closeIpForm();
      loadAuthorizedIps();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateIp = async () => {
    try {
      setError('');
      setSuccess('');

      await updateAuthorizedIp(editingIp.id, ipFormData);
      
      setSuccess('IP autorizada actualizada exitosamente');
      closeIpForm();
      loadAuthorizedIps();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteIp = async (ipId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta IP autorizada?')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      await deleteAuthorizedIp(ipId);
      setSuccess('IP autorizada eliminada exitosamente');
      loadAuthorizedIps();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditIp = (ip) => {
    setEditingIp(ip);
    setIpFormData({
      ip_address: ip.ip_address || '',
      description: ip.description || '',
      activo: ip.activo !== false,
    });
    setShowIpForm(true);
  };

  // Servidores locales: añadir entrada
  const handleAddLocalServer = () => {
    const name = (serverFormData.name || '').trim();
    const port = parseInt(serverFormData.port, 10) || 8080;
    const mode = serverFormData.mode === 'full' ? 'full' : 'merma';
    const restaurantId = mode === 'merma' ? (serverFormData.restaurantId || '').trim() : '';
    if (!name) {
      setError('El nombre del servidor es obligatorio');
      return;
    }
    if (port < 1024 || port > 65535) {
      setError('El puerto debe estar entre 1024 y 65535');
      return;
    }
    if (mode === 'merma' && !restaurantId) {
      setError('Para un servidor de merma debes seleccionar el restaurante (local) asignado a la cuenta');
      return;
    }
    if (localServersList.some((s) => s.port === port)) {
      setError('Ya existe un servidor con ese puerto');
      return;
    }
    setError('');
    setLocalServersList((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, port, mode, ...(mode === 'merma' ? { restaurantId } : {}) },
    ]);
    setServerFormData({ name: '', port: '8080', mode: 'merma', restaurantId: '' });
    closeServerForm();
  };

  const handleRemoveLocalServer = (id) => {
    setLocalServersList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStartLocalServers = async () => {
    if (localServersList.length === 0) {
      setServerError('Añade al menos un servidor');
      return;
    }
    const mermaServersWithoutRestaurant = localServersList.filter((s) => s.mode === 'merma' && !s.restaurantId);
    if (mermaServersWithoutRestaurant.length > 0) {
      setServerError('Cada servidor de merma debe tener un restaurante asignado. Edita la lista o añade de nuevo el servidor con restaurante.');
      return;
    }
    setServerLoading(true);
    setServerError('');
    const tokens = [];
    const config = [];
    try {
      for (const s of localServersList) {
        const base = { port: s.port, mode: s.mode, name: s.name };
        if (s.mode === 'merma' && s.restaurantId) {
          const token = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await registerMermaServerToken(token, s.restaurantId);
          tokens.push(token);
          const restaurant = restaurants.find((r) => r.id === s.restaurantId);
          config.push({
            ...base,
            token,
            restaurantId: s.restaurantId,
            restaurantName: restaurant?.nombre || '',
          });
        } else {
          config.push(base);
        }
      }
      const result = await startLocalServer(config);
      setServerLoading(false);
      if (result.success) {
        setRunningMermaTokens(tokens);
        setServerStatus({ running: true, servers: result.servers || [] });
        setServerError(result.errors?.length ? result.errors.map((e) => `${e.name} (${e.port}): ${e.error}`).join('. ') : '');
      } else {
        // Si falló el inicio, desregistrar los tokens que ya registramos
        for (const t of tokens) {
          try {
            await unregisterMermaServerToken(t);
          } catch (_) {}
        }
        const errMsg = result.error || 'Error al iniciar';
        const extra = result.errors?.length ? ' ' + result.errors.map((e) => `${e.name}: ${e.error}`).join('. ') : '';
        setServerError(errMsg + extra);
      }
    } catch (err) {
      setServerLoading(false);
      for (const t of tokens) {
        try {
          await unregisterMermaServerToken(t);
        } catch (_) {}
      }
      setServerError(err.message || 'Error al iniciar servidores');
    }
  };

  const handleStopLocalServers = async () => {
    setServerLoading(true);
    setServerError('');
    for (const token of runningMermaTokens) {
      try {
        await unregisterMermaServerToken(token);
      } catch (err) {
        console.warn('Error al desregistrar token:', err);
      }
    }
    setRunningMermaTokens([]);
    const result = await stopLocalServer();
    setServerLoading(false);
    if (result.success) {
      setServerStatus({ running: false, servers: [] });
    } else {
      setServerError(result.error || 'Error al detener');
    }
  };

  // Auto-iniciar servidores si se viene desde Dashboard "Iniciar servidores locales"
  useEffect(() => {
    if (activeTab !== 'local-servers') return;
    if (sessionStorage.getItem('settingsAutoStartServers') !== 'true') return;
    sessionStorage.removeItem('settingsAutoStartServers');
    handleStartLocalServers();
  }, [activeTab]);

  // Abrir formularios concretos si se viene desde Dashboard (Nuevo usuario / Nuevo rol / Nuevo restaurante)
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem('settingsOpenRoleForm') === 'true') {
      sessionStorage.removeItem('settingsOpenRoleForm');
      setActiveTab('roles');
      setShowRoleForm(true);
      setEditingRole(null);
      setRoleFormData({ role_name: '', description: '', permissions: {} });
      return;
    }
    if (sessionStorage.getItem('settingsOpenUserForm') === 'true') {
      sessionStorage.removeItem('settingsOpenUserForm');
      setActiveTab('users');
      setShowUserForm(true);
      setUserFormData({
        email: '',
        password: '',
        confirmPassword: '',
        role_name: '',
        restaurant_id: '',
        full_name: '',
        phone: ''
      });
      return;
    }
    if (sessionStorage.getItem('settingsOpenRestaurantForm') === 'true') {
      sessionStorage.removeItem('settingsOpenRestaurantForm');
      setActiveTab('restaurants');
      setShowRestaurantForm(true);
      setEditingRestaurant(null);
      setRestaurantFormData({ nombre: '', direccion: '', telefono: '', email: '', notas: '' });
    }
  }, []);

  // Mientras carga el rol, mostrar loading para no mostrar pantalla negra o Acceso Denegado por error
  if (roleLoading || roleName === undefined) {
    return (
      <div className="settings-container">
        <div className="settings-loading" style={{ color: '#D1D5DB' }}>Cargando...</div>
      </div>
    );
  }

  // Acceso a Configuración: quien tiene permiso view_settings (o es admin) puede entrar
  const canAccessSettings = roleName === 'admin' || permissions.view_settings === true;
  if (!canAccessSettings) {
    return (
      <div className="settings-container">
        <div className="settings-error" style={{ color: '#D1D5DB' }}>
          <h2 style={{ color: '#FFFFFF' }}>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  const isAdmin = roleName === 'admin';
  const canSeeTabRoles = isAdmin || permissions.view_settings_roles === true;
  const canSeeTabUsers = isAdmin || permissions.view_settings_users === true;
  const canSeeTabRestaurants = isAdmin || permissions.view_settings_restaurants === true;
  const canSeeTabAuthorizedIps = isAdmin || permissions.view_settings_authorized_ips === true;
  const canSeeTabLocalServers = isAdmin || permissions.view_settings_local_servers === true;
  const canSeeTabAppReleases = isAdmin && appReleasesUnlocked;
  const canSeeTab = (tab) => {
    if (tab === 'roles') return canSeeTabRoles;
    if (tab === 'users') return canSeeTabUsers;
    if (tab === 'restaurants') return canSeeTabRestaurants;
    if (tab === 'authorized-ips') return canSeeTabAuthorizedIps;
    if (tab === 'local-servers') return canSeeTabLocalServers;
    if (tab === 'app-releases') return canSeeTabAppReleases;
    return false;
  };
  const allowedTabs = [
    canSeeTabRoles && 'roles',
    canSeeTabUsers && 'users',
    canSeeTabRestaurants && 'restaurants',
    canSeeTabAuthorizedIps && 'authorized-ips',
    canSeeTabLocalServers && 'local-servers',
    canSeeTabAppReleases && 'app-releases',
  ].filter(Boolean);
  const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : (allowedTabs[0] || 'roles');

  // Atajo para admins: 5 clics en "Configuración" en 3 s → muestra pestaña Releases
  const handleReleasesSecretClick = () => {
    if (roleName !== 'admin') return;
    if (releasesSecretTimerRef.current) clearTimeout(releasesSecretTimerRef.current);
    const next = releasesSecretClicks + 1;
    setReleasesSecretClicks(next);
    if (next >= 5) {
      setAppReleasesUnlocked(true);
      setReleasesSecretClicks(0);
      try { sessionStorage.setItem('settingsAppReleasesUnlocked', '1'); } catch {}
    } else {
      releasesSecretTimerRef.current = setTimeout(() => setReleasesSecretClicks(0), 3000);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1
          className="settings-title"
          onClick={handleReleasesSecretClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleReleasesSecretClick()}
          aria-label="Configuración"
        >
          ⚙️ Configuración
        </h1>
        <p className="settings-subtitle">
          {allowedTabs.length ? 'Gestiona según los permisos de tu rol' : 'Sin acceso a subsecciones'}
        </p>
      </div>

      {error && (
        <div className="settings-message settings-error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="settings-message settings-success-message">
          {success}
        </div>
      )}

      {allowedTabs.length === 0 ? (
        <div className="settings-content">
          <div className="settings-info-box" style={{ marginTop: '1rem' }}>
            <p>Tienes acceso a Configuración pero no a ninguna subsección. Pide al administrador que asigne al menos uno de estos permisos a tu rol: <strong>Config: ver pestaña Roles/Usuarios/Restaurantes/IPs Autorizadas/Servidores locales</strong>.</p>
          </div>
        </div>
      ) : (
      <div className="settings-tabs">
        {canSeeTabRoles && (
          <button
            className={`settings-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Roles
          </button>
        )}
        {canSeeTabUsers && (
          <button
            className={`settings-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Usuarios
          </button>
        )}
        {canSeeTabRestaurants && (
          <button
            className={`settings-tab ${activeTab === 'restaurants' ? 'active' : ''}`}
            onClick={() => setActiveTab('restaurants')}
          >
            Restaurantes
          </button>
        )}
        {canSeeTabAuthorizedIps && (
          <button
            className={`settings-tab ${activeTab === 'authorized-ips' ? 'active' : ''}`}
            onClick={() => setActiveTab('authorized-ips')}
          >
            IPs Autorizadas
          </button>
        )}
        {canSeeTabLocalServers && (
          <button
            className={`settings-tab ${activeTab === 'local-servers' ? 'active' : ''}`}
            onClick={() => setActiveTab('local-servers')}
          >
            Servidores locales
          </button>
        )}
        {canSeeTabAppReleases && (
          <button
            className={`settings-tab settings-tab-app-releases ${activeTab === 'app-releases' ? 'active' : ''}`}
            onClick={() => setActiveTab('app-releases')}
          >
            Releases
          </button>
        )}
      </div>

      )}

      {effectiveTab === 'roles' && canSeeTabRoles && (
        <div className="settings-content">
          <div className="settings-section-header">
            <h2>Gestión de Roles</h2>
            <button
              className="settings-btn settings-btn-primary"
              onClick={() => {
                setEditingRole(null);
                setRoleFormData({ role_name: '', description: '', permissions: {} });
                setShowRoleForm(true);
              }}
            >
              + Nuevo Rol
            </button>
          </div>

          {showRoleForm && (
            <div className="settings-modal-overlay" onClick={closeRoleForm} role="dialog" aria-modal="true" aria-labelledby="settings-role-form-title">
              <div className="settings-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="settings-modal-header">
                  <h3 id="settings-role-form-title">{editingRole ? 'Editar Rol' : 'Nuevo Rol'}</h3>
                  <button type="button" className="settings-modal-close" onClick={closeRoleForm} aria-label="Cerrar">✕</button>
                </div>
                <div className="settings-form-group">
                  <label>Nombre del Rol *</label>
                  <input
                    type="text"
                    value={roleFormData.role_name}
                    onChange={(e) => setRoleFormData({ ...roleFormData, role_name: e.target.value })}
                    placeholder="Ej: gerente, supervisor"
                    disabled={editingRole?.role_name === 'admin'}
                  />
                  {editingRole?.role_name === 'admin' && (
                    <small style={{ color: 'var(--text-muted, #9CA3AF)', display: 'block', marginTop: '0.25rem' }}>
                      El nombre del rol administrador no se puede cambiar.
                    </small>
                  )}
                </div>
                <div className="settings-form-group">
                  <label>Descripción</label>
                  <textarea
                    value={roleFormData.description}
                    onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                    placeholder="Descripción del rol..."
                    rows="3"
                  />
                </div>
                <div className="settings-form-group">
                  <label>Permisos</label>
                  <div className="settings-permissions-grid">
                    {Object.entries(availablePermissions).map(([key, label]) => (
                      <label key={key} className="settings-permission-item">
                        <input
                          type="checkbox"
                          checked={!!roleFormData.permissions[key]}
                          onChange={() => handlePermissionToggle(key)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="settings-form-actions">
                  <button type="button" className="settings-btn settings-btn-secondary" onClick={closeRoleForm}>Cancelar</button>
                  <button type="button" className="settings-btn settings-btn-primary" onClick={editingRole ? handleUpdateRole : handleCreateRole}>
                    {editingRole ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingRoles ? (
            <div className="settings-loading">Cargando roles...</div>
          ) : (
            <div className="settings-roles-list">
              {roles.map((role) => (
                <div key={role.id} className="settings-role-card">
                  <div className="settings-role-header">
                    <h3>{role.role_name}</h3>
                    <div className="settings-role-actions">
                      <button
                        className="settings-btn-icon"
                        onClick={() => handleEditRole(role)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      {role.role_name !== 'admin' && (
                        <button
                          className="settings-btn-icon settings-btn-danger"
                          onClick={() => handleDeleteRole(role.role_name)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  {role.description && (
                    <p className="settings-role-description">{role.description}</p>
                  )}
                  <div className="settings-role-permissions">
                    <strong>Permisos:</strong>
                    <div className="settings-role-permissions-list">
                      {Object.entries(role.permissions || {})
                        .filter(([_, value]) => value === true)
                        .map(([key, _]) => (
                          <span key={key} className="settings-permission-badge">
                            {availablePermissions[key] || key}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {effectiveTab === 'users' && canSeeTabUsers && (
        <div className="settings-content">
          <div className="settings-section-header">
            <h2>Gestión de Usuarios</h2>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button
                className="settings-btn settings-btn-primary"
                onClick={() => {
                  setUserFormData({
                    email: '',
                    password: '',
                    confirmPassword: '',
                    role_name: roles[0]?.role_name ?? '',
                    restaurant_id: '',
                    full_name: '',
                    phone: ''
                  });
                  setShowUserForm(true);
                }}
              >
                + Nuevo Usuario
              </button>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={handleSaveUserRoles}
                disabled={
                  Object.keys(userRoleUpdates).length === 0 && 
                  Object.keys(userRestaurantUpdates).length === 0 &&
                  Object.keys(userProfileUpdates).length === 0
                }
              >
                Guardar Cambios
              </button>
            </div>
          </div>

          {showUserForm && (
            <div
              className="settings-modal-overlay"
              onClick={closeUserForm}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-user-form-title"
            >
              <div
                className="settings-modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-modal-header">
                  <h3 id="settings-user-form-title">Nuevo Usuario</h3>
                  <button
                    type="button"
                    className="settings-modal-close"
                    onClick={closeUserForm}
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>

                <div className="settings-form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label>Contraseña *</label>
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label>Confirmar Contraseña *</label>
                  <input
                    type="password"
                    value={userFormData.confirmPassword}
                    onChange={(e) => setUserFormData({ ...userFormData, confirmPassword: e.target.value })}
                    placeholder="Repite la contraseña"
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label>Rol *</label>
                  <select
                    value={userFormData.role_name}
                    onChange={(e) => setUserFormData({ ...userFormData, role_name: e.target.value })}
                    className="settings-role-select"
                  >
                    {roles.map((role) => (
                      <option key={role.role_name} value={role.role_name}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                {userFormData.role_name !== 'admin' && (
                  <div className="settings-form-group">
                    <label>Restaurante</label>
                    <select
                      value={userFormData.restaurant_id || ''}
                      onChange={(e) => setUserFormData({ ...userFormData, restaurant_id: e.target.value || '' })}
                      className="settings-role-select"
                    >
                      <option value="">Sin restaurante</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="settings-form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    value={userFormData.full_name}
                    onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                    placeholder="Nombre completo del usuario"
                  />
                </div>

                <div className="settings-form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="Número de teléfono"
                  />
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn-secondary"
                    onClick={closeUserForm}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn-primary"
                    onClick={handleCreateUser}
                  >
                    Crear Usuario
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingUsers ? (
            <div className="settings-loading">Cargando usuarios...</div>
          ) : (
            <div className="settings-users-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Restaurante</th>
                    <th>Fecha Creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const profileUpdate = userProfileUpdates[user.id] || {};
                    const currentFullName = profileUpdate.full_name !== undefined 
                      ? profileUpdate.full_name 
                      : (user.full_name || '');
                    const currentPhone = profileUpdate.phone !== undefined 
                      ? profileUpdate.phone 
                      : (user.phone || '');
                    const currentRole = userRoleUpdates[user.id] !== undefined 
                      ? userRoleUpdates[user.id] 
                      : user.role_name;
                    // Obtener el restaurant_id del usuario
                    // Puede venir directamente o desde el objeto restaurant
                    const userRestaurantId = user.restaurant_id || user.restaurant?.id || null;
                    
                    // Si hay una actualización pendiente, usar esa
                    // Si no, usar el restaurant_id del usuario
                    let currentRestaurant = '';
                    if (userRestaurantUpdates[user.id] !== undefined) {
                      // Hay una actualización pendiente
                      currentRestaurant = userRestaurantUpdates[user.id] ? String(userRestaurantUpdates[user.id]) : '';
                    } else if (userRestaurantId) {
                      // Usar el restaurant_id del usuario (convertir a string para comparación)
                      currentRestaurant = String(userRestaurantId);
                    }
                    
                    // Log para depuración
                    if (userRestaurantId && !currentRestaurant) {
                      console.warn('[Settings] Problema con restaurant_id:', {
                        userId: user.id,
                        userRestaurantId,
                        userRestaurantIdType: typeof userRestaurantId,
                        currentRestaurant,
                        availableRestaurants: restaurants.map(r => ({ id: r.id, idType: typeof r.id }))
                      });
                    }
                    
                    return (
                      <tr key={user.id}>
                        <td>{user.email || user.id.substring(0, 8) + '...'}</td>
                        <td>
                          <input
                            type="text"
                            value={currentFullName}
                            onChange={(e) => handleUserProfileFieldChange(user.id, 'full_name', e.target.value)}
                            placeholder="Nombre completo"
                            className="settings-user-field-input"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={currentPhone}
                            onChange={(e) => handleUserProfileFieldChange(user.id, 'phone', e.target.value)}
                            placeholder="Teléfono"
                            className="settings-user-field-input"
                          />
                        </td>
                        <td>
                          <select
                            value={currentRole}
                            onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                            className="settings-role-select"
                          >
                            {roles.map((role) => (
                              <option key={role.role_name} value={role.role_name}>
                                {role.role_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={currentRestaurant}
                            onChange={(e) => handleUserRestaurantChange(user.id, e.target.value || null)}
                            className="settings-role-select"
                          >
                            <option value="">Sin restaurante</option>
                            {restaurants.map((restaurant) => (
                              <option key={restaurant.id} value={String(restaurant.id)}>
                                {restaurant.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{new Date(user.created_at || user.profile_created_at).toLocaleDateString()}</td>
                        <td>
                          {user.id !== currentUser?.id ? (
                            <button
                              type="button"
                              className="settings-btn-icon settings-btn-danger"
                              onClick={() => handleDeleteUser(user.id, user.email || user.full_name)}
                              title="Eliminar usuario"
                            >
                              🗑️
                            </button>
                          ) : (
                            <span className="settings-current-user-badge">Tú</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {effectiveTab === 'restaurants' && canSeeTabRestaurants && (
        <div className="settings-content">
          <div className="settings-section-header">
            <h2>Gestión de Restaurantes</h2>
            <button
              className="settings-btn settings-btn-primary"
              onClick={() => {
                setEditingRestaurant(null);
                setRestaurantFormData({ nombre: '', direccion: '', telefono: '', email: '', notas: '' });
                setShowRestaurantForm(true);
              }}
            >
              + Nuevo Restaurante
            </button>
          </div>

          {showRestaurantForm && (
            <div className="settings-modal-overlay" onClick={closeRestaurantForm} role="dialog" aria-modal="true" aria-labelledby="settings-restaurant-form-title">
              <div className="settings-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="settings-modal-header">
                  <h3 id="settings-restaurant-form-title">{editingRestaurant ? 'Editar Restaurante' : 'Nuevo Restaurante'}</h3>
                  <button type="button" className="settings-modal-close" onClick={closeRestaurantForm} aria-label="Cerrar">✕</button>
                </div>
                <div className="settings-form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={restaurantFormData.nombre}
                    onChange={(e) => setRestaurantFormData({ ...restaurantFormData, nombre: e.target.value })}
                    placeholder="Nombre del restaurante"
                    required
                  />
                </div>
                <div className="settings-form-group">
                  <label>Dirección</label>
                  <input
                    type="text"
                    value={restaurantFormData.direccion}
                    onChange={(e) => setRestaurantFormData({ ...restaurantFormData, direccion: e.target.value })}
                    placeholder="Dirección del restaurante"
                  />
                </div>
                <div className="settings-form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={restaurantFormData.telefono}
                    onChange={(e) => setRestaurantFormData({ ...restaurantFormData, telefono: e.target.value })}
                    placeholder="Teléfono de contacto"
                  />
                </div>
                <div className="settings-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={restaurantFormData.email}
                    onChange={(e) => setRestaurantFormData({ ...restaurantFormData, email: e.target.value })}
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div className="settings-form-group">
                  <label>Notas</label>
                  <textarea
                    value={restaurantFormData.notas}
                    onChange={(e) => setRestaurantFormData({ ...restaurantFormData, notas: e.target.value })}
                    placeholder="Notas adicionales..."
                    rows="3"
                  />
                </div>
                <div className="settings-form-actions">
                  <button type="button" className="settings-btn settings-btn-secondary" onClick={closeRestaurantForm}>Cancelar</button>
                  <button type="button" className="settings-btn settings-btn-primary" onClick={editingRestaurant ? handleUpdateRestaurant : handleCreateRestaurant}>
                    {editingRestaurant ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingRestaurants ? (
            <div className="settings-loading">Cargando restaurantes...</div>
          ) : (
            <div className="settings-restaurants-list">
              {restaurants.map((restaurant) => (
                <div key={restaurant.id} className="settings-role-card">
                  <div className="settings-role-header">
                    <h3>{restaurant.nombre}</h3>
                    <div className="settings-role-actions">
                      <button
                        className="settings-btn settings-btn-small"
                        onClick={() => {
                          setEditingRestaurant(restaurant);
                          setRestaurantFormData({
                            nombre: restaurant.nombre || '',
                            direccion: restaurant.direccion || '',
                            telefono: restaurant.telefono || '',
                            email: restaurant.email || '',
                            notas: restaurant.notas || ''
                          });
                          setShowRestaurantForm(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="settings-btn settings-btn-small settings-btn-danger"
                        onClick={() => handleDeleteRestaurant(restaurant.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <div className="settings-role-details">
                    {restaurant.direccion && <p><strong>Dirección:</strong> {restaurant.direccion}</p>}
                    {restaurant.telefono && <p><strong>Teléfono:</strong> {restaurant.telefono}</p>}
                    {restaurant.email && <p><strong>Email:</strong> {restaurant.email}</p>}
                    {restaurant.notas && <p><strong>Notas:</strong> {restaurant.notas}</p>}
                  </div>
                </div>
              ))}
              {restaurants.length === 0 && (
                <div className="settings-empty">
                  <p>No hay restaurantes registrados</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {effectiveTab === 'authorized-ips' && (
        <div className="settings-content">
          <div className="settings-section-header">
            <h2>IPs Autorizadas para Merma Local</h2>
            {isElectron() && (
              <button
                className="settings-btn settings-btn-primary"
                onClick={() => {
                  setEditingIp(null);
                  setIpFormData({ ip_address: '', description: '', activo: true });
                  setShowIpForm(true);
                }}
              >
                + Nueva IP
              </button>
            )}
          </div>

          <div className="settings-info-box">
            <p>
              <strong>📡 Servidor Local de Merma:</strong> Las IPs autorizadas pueden acceder a la interfaz 
              simplificada de merma desde la red local. Solo se mostrará el formulario de registro de merma.
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#9CA3AF' }}>
              Las IPs se guardan <strong>solo en este equipo</strong>, cifradas (no en base de datos). Para activar los servidores locales, ve a Servidores locales.
            </p>
          </div>

          {!isElectron() ? (
            <div className="settings-info-box" style={{ marginTop: '1rem' }}>
              <p>Las IPs autorizadas solo están disponibles en la <strong>aplicación de escritorio</strong>. Aquí se guardan de forma local y cifrada.</p>
            </div>
          ) : (
            <>
          {showIpForm && (
            <div className="settings-modal-overlay" onClick={closeIpForm} role="dialog" aria-modal="true" aria-labelledby="settings-ip-form-title">
              <div className="settings-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="settings-modal-header">
                  <h3 id="settings-ip-form-title">{editingIp ? 'Editar IP Autorizada' : 'Nueva IP Autorizada'}</h3>
                  <button type="button" className="settings-modal-close" onClick={closeIpForm} aria-label="Cerrar">✕</button>
                </div>
                <div className="settings-form-group">
                  <label>Dirección IP *</label>
                  <input
                    type="text"
                    value={ipFormData.ip_address}
                    onChange={(e) => setIpFormData({ ...ipFormData, ip_address: e.target.value })}
                    placeholder="Ej: 192.168.1.100"
                    required
                  />
                  <small style={{ color: '#9CA3AF', marginTop: '0.25rem' }}>
                    Dirección IP que podrá acceder a la interfaz de merma
                  </small>
                </div>
                <div className="settings-form-group">
                  <label>Descripción</label>
                  <input
                    type="text"
                    value={ipFormData.description}
                    onChange={(e) => setIpFormData({ ...ipFormData, description: e.target.value })}
                    placeholder="Ej: Tablet cocina, Terminal punto de venta"
                  />
                </div>
                <div className="settings-form-group">
                  <label className="settings-checkbox-label">
                    <input
                      type="checkbox"
                      checked={ipFormData.activo}
                      onChange={(e) => setIpFormData({ ...ipFormData, activo: e.target.checked })}
                    />
                    <span>Activa</span>
                  </label>
                </div>
                <div className="settings-form-actions">
                  <button type="button" className="settings-btn settings-btn-secondary" onClick={closeIpForm}>Cancelar</button>
                  <button type="button" className="settings-btn settings-btn-primary" onClick={editingIp ? handleUpdateIp : handleCreateIp}>
                    {editingIp ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingIps ? (
            <div className="settings-loading">Cargando IPs autorizadas...</div>
          ) : (
            <div className="settings-ips-list">
              {authorizedIps.map((ip) => (
                <div key={ip.id} className="settings-role-card">
                  <div className="settings-role-header">
                    <h3>
                      {ip.ip_address}
                      {!ip.activo && <span style={{ color: '#9CA3AF', fontSize: '0.9rem', marginLeft: '0.5rem' }}>(Inactiva)</span>}
                    </h3>
                    <div className="settings-role-actions">
                      <button
                        className="settings-btn settings-btn-small"
                        onClick={() => handleEditIp(ip)}
                      >
                        Editar
                      </button>
                      <button
                        className="settings-btn settings-btn-small settings-btn-danger"
                        onClick={() => handleDeleteIp(ip.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {ip.description && (
                    <div className="settings-role-details">
                      <p><strong>Descripción:</strong> {ip.description}</p>
                    </div>
                  )}
                </div>
              ))}
              {authorizedIps.length === 0 && (
                <div className="settings-empty">
                  <p>No hay IPs autorizadas registradas</p>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {effectiveTab === 'local-servers' && (
        <div className="settings-content">
          <div className="settings-section-header">
            <h2>Servidores locales (red)</h2>
            {isElectron() && (() => {
              const canCreateMerma = isAdmin || permissions.create_server_merma === true;
              const canCreateFull = isAdmin || permissions.create_server_full === true;
              const canAddAnyServer = canCreateMerma || canCreateFull;
              return canAddAnyServer ? (
                <button
                  className="settings-btn settings-btn-primary"
                  onClick={() => {
                    const defaultMode = canCreateMerma ? 'merma' : 'full';
                    setServerFormData({ name: '', port: '8080', mode: defaultMode, restaurantId: '' });
                    setShowServerForm(true);
                    setServerError('');
                  }}
                >
                  + Añadir servidor
                </button>
              ) : null;
            })()}
          </div>

          {!isElectron() ? (
            <div className="settings-info-box">
              <p>
                Los servidores locales solo están disponibles en la <strong>aplicación de escritorio</strong> (Electron).
                Aquí puedes configurar varios servidores: uno para merma (solo interfaz merma, IPs autorizadas) y otro para app completa (login normal).
              </p>
            </div>
          ) : (
            <>
              <div className="settings-info-box">
                <p>
                  <strong>Servidores en la red:</strong> Puedes definir varios servidores, cada uno en un puerto distinto.
                </p>
                <ul style={{ margin: '0.5rem 0 0 1rem', color: '#9CA3AF', fontSize: '0.9rem' }}>
                  <li><strong>Merma:</strong> Sirve solo la interfaz de registro de merma. Solo pueden acceder las IPs autorizadas (pestaña IPs Autorizadas).</li>
                  <li><strong>App completa:</strong> Sirve la aplicación completa; los usuarios deben iniciar sesión normalmente.</li>
                </ul>
                <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#9CA3AF' }}>
                  Al cerrar la aplicación se invalidan los tokens de merma; las pestañas abiertas de la interfaz de merma dejarán de poder registrar.
                </p>
              </div>

              {showServerForm && (
                <div className="settings-modal-overlay" onClick={closeServerForm} role="dialog" aria-modal="true" aria-labelledby="settings-server-form-title">
                  <div className="settings-modal-box" onClick={(e) => e.stopPropagation()}>
                    <div className="settings-modal-header">
                      <h3 id="settings-server-form-title">Nuevo servidor</h3>
                      <button type="button" className="settings-modal-close" onClick={closeServerForm} aria-label="Cerrar">✕</button>
                    </div>
                    <div className="settings-form-group">
                      <label>Nombre *</label>
                      <input
                        type="text"
                        value={serverFormData.name}
                        onChange={(e) => setServerFormData({ ...serverFormData, name: e.target.value })}
                        placeholder="Ej: Merma cocina, App tablet"
                      />
                    </div>
                    <div className="settings-form-group">
                      <label>Puerto *</label>
                      <input
                        type="number"
                        value={serverFormData.port}
                        onChange={(e) => setServerFormData({ ...serverFormData, port: e.target.value })}
                        placeholder="8080"
                        min="1024"
                        max="65535"
                      />
                    </div>
                    <div className="settings-form-group">
                      <label>Tipo</label>
                      <select
                        value={serverFormData.mode}
                        onChange={(e) => setServerFormData({ ...serverFormData, mode: e.target.value, restaurantId: e.target.value === 'full' ? '' : serverFormData.restaurantId })}
                      >
                        {(isAdmin || permissions?.create_server_merma === true) && (
                          <option value="merma">Merma (solo interfaz merma, IPs autorizadas)</option>
                        )}
                        {(isAdmin || permissions?.create_server_full === true) && (
                          <option value="full">App completa (login normal)</option>
                        )}
                      </select>
                    </div>
                    {serverFormData.mode === 'merma' && (
                      <div className="settings-form-group">
                        <label>Restaurante (local) de la cuenta *</label>
                        <select
                          value={serverFormData.restaurantId}
                          onChange={(e) => setServerFormData({ ...serverFormData, restaurantId: e.target.value })}
                          required
                        >
                          <option value="">Seleccionar restaurante</option>
                          {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                        </select>
                        <small style={{ color: '#9CA3AF', marginTop: '0.25rem', display: 'block' }}>
                          La merma se registrará como la cuenta que inicia el servidor y en este restaurante.
                        </small>
                      </div>
                    )}
                    <div className="settings-form-actions">
                      <button type="button" className="settings-btn settings-btn-secondary" onClick={closeServerForm}>Cancelar</button>
                      <button type="button" className="settings-btn settings-btn-primary" onClick={handleAddLocalServer}>Añadir</button>
                    </div>
                  </div>
                </div>
              )}

              {serverError && (
                <div className="settings-message settings-error-message" style={{ marginBottom: '1rem' }}>
                  {serverError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  className="settings-btn settings-btn-primary"
                  onClick={handleStartLocalServers}
                  disabled={serverLoading || localServersList.length === 0}
                >
                  {serverLoading ? 'Iniciando...' : 'Iniciar todos'}
                </button>
                <button
                  className="settings-btn settings-btn-secondary"
                  onClick={handleStopLocalServers}
                  disabled={serverLoading || !serverStatus.running}
                >
                  Detener todos
                </button>
              </div>

              {serverStatus.running && serverStatus.servers && serverStatus.servers.length > 0 && (
                <div className="settings-message settings-success-message" style={{ marginBottom: '1rem' }}>
                  <strong>Servidores activos</strong>
                  <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                    {serverStatus.servers.map((s) => (
                      <li key={s.port}>
                        {s.name} (puerto {s.port}): <code>{s.url}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="settings-restaurants-list">
                {localServersList.map((s) => (
                  <div key={s.id} className="settings-role-card">
                    <div className="settings-role-header">
                      <h3>
                        {s.name} — puerto {s.port}{' '}
                        ({s.mode === 'merma' ? 'Merma' : 'App completa'}
                        {s.mode === 'merma' && s.restaurantId && restaurants.find((r) => r.id === s.restaurantId) && (
                          <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.9rem' }}>
                            {' '}· {restaurants.find((r) => r.id === s.restaurantId).nombre}
                          </span>
                        )})
                      </h3>
                      <div className="settings-role-actions">
                        <button
                          className="settings-btn settings-btn-small settings-btn-danger"
                          onClick={() => handleRemoveLocalServer(s.id)}
                          disabled={serverStatus.running}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {localServersList.length === 0 && (
                  <div className="settings-empty">
                    <p>Añade al menos un servidor (nombre, puerto y tipo) y pulsa &quot;Iniciar todos&quot;.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {effectiveTab === 'app-releases' && canSeeTabAppReleases && (
        <div className="settings-content settings-app-releases">
          <h2 style={{ marginTop: 0 }}>Releases y versión mínima</h2>
          <p className="settings-app-releases-hint">
            Solo visible para administradores. Sube instaladores al bucket app-releases y gestiona la versión mínima requerida.
          </p>

          <div className="settings-app-releases-section">
            <h3>Versión mínima requerida</h3>
            <p className="settings-app-releases-desc">
              Los usuarios con versión inferior no podrán acceder. Formato: 1.0.0
            </p>
            {loadingMinVersion ? (
              <p style={{ color: '#9CA3AF' }}>Cargando...</p>
            ) : (
              <div className="settings-app-releases-row">
                <input
                  type="text"
                  className="settings-form-input"
                  value={minimumVersion ?? ''}
                  onChange={(e) => setMinimumVersion(e.target.value)}
                  placeholder="1.0.0"
                  style={{ maxWidth: '10rem' }}
                />
                <button
                  className="settings-btn settings-btn-primary"
                  onClick={async () => {
                    try {
                      setError('');
                      setSuccess('');
                      await updateMinimumVersion(minimumVersion);
                      setSuccess('Versión mínima actualizada');
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                  disabled={!minimumVersion?.trim()}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>

          <div className="settings-app-releases-section">
            <h3>Subir nuevo release</h3>
            <p className="settings-app-releases-desc">
              Sube el archivo (.exe, .dmg, .zip) y se registrará en la base de datos. Plataformas: win32, darwin-x64, darwin-arm64, linux.
            </p>
            <div className="settings-app-releases-form">
              <div className="settings-form-group">
                <label>Versión *</label>
                <input
                  type="text"
                  className="settings-form-input"
                  value={releaseFormData.version}
                  onChange={(e) => setReleaseFormData((p) => ({ ...p, version: e.target.value }))}
                  placeholder="1.9.5"
                />
              </div>
              <div className="settings-form-group">
                <label>Plataforma *</label>
                <select
                  className="settings-form-input"
                  value={releaseFormData.platform}
                  onChange={(e) => setReleaseFormData((p) => ({ ...p, platform: e.target.value }))}
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="settings-form-group">
                <label>Archivo *</label>
                <input
                  type="file"
                  accept=".exe,.dmg,.zip"
                  onChange={(e) => setReleaseFormData((p) => ({ ...p, file: e.target.files?.[0] || null }))}
                  className="settings-form-input"
                />
                {releaseFormData.file && (
                  <small style={{ color: '#9CA3AF' }}>{releaseFormData.file.name} ({(releaseFormData.file.size / 1024 / 1024).toFixed(2)} MB)</small>
                )}
              </div>
              <div className="settings-form-group">
                <label>Notas de la versión (opcional)</label>
                <textarea
                  className="settings-form-input"
                  value={releaseFormData.releaseNotes}
                  onChange={(e) => setReleaseFormData((p) => ({ ...p, releaseNotes: e.target.value }))}
                  placeholder="Correcciones y mejoras..."
                  rows={3}
                />
              </div>
              <button
                className="settings-btn settings-btn-primary"
                onClick={async () => {
                  try {
                    setError('');
                    setSuccess('');
                    setUploadingRelease(true);
                    await createAppRelease({
                      version: releaseFormData.version.trim(),
                      platform: releaseFormData.platform,
                      file: releaseFormData.file,
                      releaseNotes: releaseFormData.releaseNotes,
                    });
                    setSuccess('Release subido correctamente');
                    setReleaseFormData({ version: '', platform: 'win32', file: null, releaseNotes: '' });
                    const releases = await getAppReleases();
                    setAppReleases(releases);
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setUploadingRelease(false);
                  }
                }}
                disabled={uploadingRelease || !releaseFormData.version?.trim() || !releaseFormData.file}
              >
                {uploadingRelease ? 'Subiendo...' : 'Subir release'}
              </button>
            </div>
          </div>

          <div className="settings-app-releases-section">
            <h3>Releases registrados</h3>
            {loadingReleases ? (
              <p style={{ color: '#9CA3AF' }}>Cargando...</p>
            ) : appReleases.length === 0 ? (
              <p className="settings-app-releases-empty">No hay releases registrados.</p>
            ) : (
              <div className="settings-app-releases-list">
                {appReleases.map((r) => (
                  <div key={r.id} className={`settings-app-release-card ${!r.is_active ? 'inactive' : ''}`}>
                    <div className="settings-app-release-info">
                      <strong>{r.version}</strong> · {r.platform} · {r.file_path}
                      {r.file_size && <span style={{ color: '#9CA3AF' }}> ({(r.file_size / 1024 / 1024).toFixed(2)} MB)</span>}
                    </div>
                    <div className="settings-app-release-actions">
                      <button
                        className={`settings-btn settings-btn-small ${r.is_active ? 'settings-btn-secondary' : 'settings-btn-primary'}`}
                        onClick={async () => {
                          try {
                            setError('');
                            if (r.is_active) {
                              await deactivateAppRelease(r.id);
                              setSuccess('Release desactivado');
                            } else {
                              await activateAppRelease(r.id);
                              setSuccess('Release reactivado');
                            }
                            const releases = await getAppReleases();
                            setAppReleases(releases);
                            setTimeout(() => setSuccess(''), 3000);
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        {r.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
