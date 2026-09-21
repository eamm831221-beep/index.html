// URL de tu Web App de Google (la obtendrás al publicar el script)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwFALg_LLPhk8bwMcIEOAdAJgtFLQ7SZdQP-7GPSmAmvGyyKCuzrJFpSmjWgzZ2vwq7/exec";

// Registrar el Service Worker de la PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker Activo"));
}

// Configurar IndexedDB en el dispositivo móvil
let db;
const request = indexedDB.open("VCXC_OfflineDB", 1);

request.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("visitas_vcxc", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = function(e) {
    db = e.target.result;
    actualizarContador();
};

// Captura Física de Coordenadas de Satélite (Trabaja Offline)
document.getElementById('btn-gps').addEventListener('click', () => {
    const latInput = document.getElementById('latitud');
    const lonInput = document.getElementById('longitud');
    
    if (navigator.geolocation) {
        latInput.placeholder = "Buscando señal Satelital...";
        lonInput.placeholder = "Buscando señal Satelital...";
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                latInput.value = pos.coords.latitude;
                lonInput.value = pos.coords.longitude;
            },
            (error) => {
                alert("Error de Hardware GPS. Por favor activa la Ubicación / GPS nativo de tu celular.");
                latInput.placeholder = "Latitud";
                lonInput.placeholder = "Longitud";
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    } else {
        alert("Este dispositivo móvil no cuenta con hardware GPS compatible.");
    }
});

// Captura de datos del formulario y almacenamiento en caché del celular
document.getElementById('visita-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const timestamp = new Date();
    
    // Objeto con la información estructurada
    const registro = {
        fecha: timestamp.toLocaleDateString('es-MX'),
        hora: timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        latitud: document.getElementById('latitud').value,
        longitud: document.getElementById('longitud').value,
        servidor: document.getElementById('servidor').value,
        nombre: document.getElementById('nombre').value,
        apellido_paterno: document.getElementById('apellido_paterno').value,
        apellido_materno: document.getElementById('apellido_materno').value,
        telefono: document.getElementById('telefono').value,
        sexo: document.querySelector('input[name="sexo"]:checked').value,
        grupo_edad: document.querySelector('input[name="grupo_edad"]:checked').value,
        domicilio: document.getElementById('domicilio').value,
        localidad: document.getElementById('localidad').value,
        zona: document.getElementById('zona').value,
        seccion: document.getElementById('seccion').value,
        programa: document.getElementById('programa').value,
        recepcion: document.getElementById('recepcion').value,
        problematica: document.getElementById('problematica').value,
        observacion: document.getElementById('observacion').value
    };

    // Escritura en IndexedDB sin requerir internet
    const transaction = db.transaction(["visitas_vcxc"], "readwrite");
    const store = transaction.objectStore("visitas_vcxc");
    store.add(registro);

    transaction.oncomplete = () => {
        alert("Registro guardado con éxito en el dispositivo móvil.");
        document.getElementById('visita-form').reset();
        actualizarContador();
    };
});

function actualizarContador() {
    const transaction = db.transaction(["visitas_vcxc"], "readonly");
    const store = transaction.objectStore("visitas_vcxc");
    const countRequest = store.count();

    countRequest.onsuccess = () => {
        document.getElementById('local-count').innerText = countRequest.result;
    };
}
// Botón de sincronización masiva al final de la jornada laboral
document.getElementById('btn-sync').addEventListener('click', () => {
    if (!navigator.onLine) {
        alert("Sincronización rechazada: No se detecta conexión a internet en este dispositivo móvil.");
        return;
    }

    const transaction = db.transaction(["visitas_vcxc"], "readonly");
    const store = transaction.objectStore("visitas_vcxc");
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
        const registrosAcumulados = getAllRequest.result;
        if (registrosAcumulados.length === 0) {
            alert("No tienes registros pendientes en tu memoria local.");
            return;
        }

        document.getElementById('btn-sync').innerText = "Enviando paquete de datos...";
        document.getElementById('btn-sync').disabled = true;

        try {
            await fetch(WEB_APP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(registrosAcumulados)
            });

            // Limpieza absoluta de la caché local tras confirmación de envío
            const clearTransaction = db.transaction(["visitas_vcxc"], "readwrite");
            const clearStore = clearTransaction.objectStore("visitas_vcxc");
            clearStore.clear();

            clearTransaction.oncomplete = () => {
                alert(`¡Éxito total! Se migraron ${registrosAcumulados.length} encuestas a la hoja Google Sheets VCXC.`);
                document.getElementById('btn-sync').innerText = "Sincronizar a Google Sheets";
                document.getElementById('btn-sync').disabled = false;
                actualizarContador();
            };

        } catch (error) {
            alert("Error crítico de transmisión de red. Intenta de nuevo.");
            document.getElementById('btn-sync').innerText = "Sincronizar a Google Sheets";
            document.getElementById('btn-sync').disabled = false;
        }
    };
});
