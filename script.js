// ================================
// ДОСТУПНЫЙ МАРШРУТ
// script.js
// ================================

// Города: значение в списке -> название и координаты центра
const CITIES = {
    sochi: { name: "Сочи", coordinates: [43.5855, 39.7231] },
    moscow: { name: "Москва", coordinates: [55.7558, 37.6173] },
    kazan: { name: "Казань", coordinates: [55.7887, 49.1221] },
    spb: { name: "Санкт-Петербург", coordinates: [59.9343, 30.3351] }
};

// Категории пользователей
const USER_TYPES = {
    default: "",
    wheelchair: "человек на коляске",
    stroller: "родитель с коляской",
    senior: "пожилой человек"
};

let map = null;
let multiRoute = null;


// ================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================

function getCity(key) {
    return CITIES[key] || CITIES.sochi;
}

// Сообщение под кнопкой «Построить маршрут»
function showMessage(message, type) {
    console.log(message);

    const el = document.getElementById("routeMessage");

    if (!el) {
        return;
    }

    el.textContent = message;
    el.style.color = type === "error" ? "#ad5850" : "";
    el.style.fontWeight = type === "error" ? "600" : "";
    el.style.fontSize = type === "error" ? "14px" : "";
}

// Если в скрипте случится неожиданная ошибка, покажем её на странице
window.addEventListener("error", function (event) {
    showMessage("Ошибка на странице: " + event.message, "error");
});

// Блок «Оценка доступности»
function showResult(text) {
    const box = document.getElementById("routeResult");
    const description = document.getElementById("resultDescription");

    if (!box || !description) {
        return;
    }

    description.textContent = text;
    box.hidden = false;
}

function hideResult() {
    const box = document.getElementById("routeResult");

    if (box) {
        box.hidden = true;
    }
}

// Добавляем город к адресу, если пользователь его не указал
function prepareAddress(address, cityName) {
    address = address.trim();

    if (!address) {
        return "";
    }

    const lower = address.toLowerCase();

    const hasCity = Object.values(CITIES).some(function (city) {
        return lower.includes(city.name.toLowerCase());
    });

    if (hasCity) {
        return address;
    }

    return cityName + ", " + address;
}


// ================================
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ================================

function initMap() {
    const citySelect = document.getElementById("citySelect");
    const city = getCity(citySelect ? citySelect.value : "sochi");

    map = new ymaps.Map("map", {
        center: city.coordinates,
        zoom: 12,
        controls: ["zoomControl", "fullscreenControl"]
    });
}


// ================================
// ГЕОКОДИРОВАНИЕ
// ================================

async function geocodeAddress(address) {
    let result;

    try {
        result = await ymaps.geocode(address, { results: 1 });
    } catch (error) {
        console.error("Ошибка геокодирования:", error);
        const details = error && error.message ? error.message : String(error);
        const hint = location.protocol === "file:"
            ? " Сайт открыт как файл: откройте его по ссылке github.io."
            : " Отключите VPN и блокировщики рекламы, проверьте API-ключ Яндекса.";

        throw new Error("Не удалось связаться с геокодером Яндекса." + hint + " Подробности: " + details);
    }

    if (!result || !result.geoObjects || result.geoObjects.getLength() === 0) {
        throw new Error('Адрес "' + address + '" не найден. Проверьте написание.');
    }

    const first = result.geoObjects.get(0);

    return first.geometry.getCoordinates();
}


// ================================
// УДАЛЕНИЕ ПРЕДЫДУЩЕГО МАРШРУТА
// ================================

function removePreviousRoute() {
    if (map && multiRoute) {
        try {
            map.geoObjects.remove(multiRoute);
        } catch (error) {
            console.warn("Не удалось удалить предыдущий маршрут:", error);
        }
    }

    multiRoute = null;
}


// ================================
// ПОСТРОЕНИЕ МАРШРУТА
// ================================

async function buildRoute(event) {
    if (event) {
        event.preventDefault();
    }

    if (!map) {
        showMessage("Карта ещё не загрузилась. Подождите немного и попробуйте снова.", "error");
        return;
    }

    const from = document.getElementById("fromInput").value.trim();
    const to = document.getElementById("toInput").value.trim();
    const cityKey = document.getElementById("citySelect").value;
    const userTypeKey = document.getElementById("userType").value;
    const avoidStairs = document.getElementById("avoidStairs").checked;

    if (!from) {
        showMessage("Введите адрес отправления.", "error");
        return;
    }

    if (!to) {
        showMessage("Введите адрес назначения.", "error");
        return;
    }

    const cityName = getCity(cityKey).name;

    removePreviousRoute();
    hideResult();
    showMessage("Ищу адреса и строю маршрут...");

    try {
        const startCoordinates = await geocodeAddress(prepareAddress(from, cityName));
        const endCoordinates = await geocodeAddress(prepareAddress(to, cityName));

        const route = new ymaps.multiRouter.MultiRoute(
            {
                referencePoints: [startCoordinates, endCoordinates],
                params: {
                    routingMode: "pedestrian",
                    results: 1
                }
            },
            {
                boundsAutoApply: true,
                routeActiveStrokeWidth: 6,
                routeActiveStrokeColor: "#1976d2",
                routeStrokeWidth: 4,
                routeStrokeColor: "#1976d2"
            }
        );

        multiRoute = route;

        route.model.events.add("requestsuccess", function () {
            let distance = "";
            let duration = "";

            try {
                const active = route.getActiveRoute();

                if (active) {
                    distance = active.properties.get("distance").text;
                    duration = active.properties.get("duration").text;
                }
            } catch (error) {
                console.warn("Не удалось получить длину маршрута:", error);
            }

            let message = "Маршрут построен.";

            if (distance && duration) {
                message += " Пешком: " + distance + ", около " + duration + ".";
            }

            showMessage(message);

            let description = "Пешеходный маршрут построен";

            if (distance && duration) {
                description += " (" + distance + ", " + duration + ")";
            }

            description += ".";

            if (avoidStairs) {
                description += " Пожелание избегать лестниц учтено, насколько это возможно.";
            }

            if (USER_TYPES[userTypeKey]) {
                description += " Категория: " + USER_TYPES[userTypeKey] + ".";
            }

            description += " Оценка предварительная, перед поездкой проверьте путь лично.";

            showResult(description);
        });

        route.model.events.add("requestfail", function () {
            showMessage("Яндекс Карты не смогли построить пешеходный маршрут между этими адресами.", "error");
        });

        map.geoObjects.add(route);

    } catch (error) {
        console.error("Ошибка:", error);
        showMessage(error.message || "Произошла ошибка при построении маршрута.", "error");
    }
}


// ================================
// ФОРМА МАРШРУТА И СМЕНА ГОРОДА
// ================================

function setupForm() {
    const form = document.getElementById("routeForm");

    if (form) {
        form.addEventListener("submit", buildRoute);
    }
}

function setupCityChange() {
    const citySelect = document.getElementById("citySelect");
    const cityStatus = document.getElementById("cityStatus");

    if (!citySelect) {
        return;
    }

    citySelect.addEventListener("change", function () {
        const city = getCity(citySelect.value);

        if (cityStatus) {
            cityStatus.textContent = city.name;
        }

        if (map) {
            map.setCenter(city.coordinates, 12);
        }

        removePreviousRoute();
        hideResult();
        showMessage("Заполните поля «Откуда» и «Куда», затем нажмите «Построить маршрут».");
    });
}


// ================================
// ВХОД / РЕГИСТРАЦИЯ (в этом браузере)
// ================================

const USER_STORAGE_KEY = "accessibleRouteUser";

function readUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
    } catch (error) {
        return null;
    }
}

function saveUser(user) {
    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        return true;
    } catch (error) {
        return false;
    }
}

function setupAuth() {
    const openButton = document.getElementById("openAuthButton");
    const closeButton = document.getElementById("closeAuthButton");
    const modal = document.getElementById("authModal");
    const form = document.getElementById("authForm");
    const message = document.getElementById("authMessage");

    if (!openButton || !modal || !form) {
        return;
    }

    function updateButton() {
        const user = readUser();
        openButton.textContent = user ? user.name : "Войти";
    }

    function openModal() {
        const user = readUser();

        if (user) {
            document.getElementById("nameInput").value = user.name;
            document.getElementById("emailInput").value = user.email;
            message.textContent = "Вы уже вошли как " + user.name + ".";
        } else {
            message.textContent = "";
        }

        modal.hidden = false;
    }

    function closeModal() {
        modal.hidden = true;
    }

    openButton.addEventListener("click", openModal);

    if (closeButton) {
        closeButton.addEventListener("click", closeModal);
    }

    // Закрытие по клику на тёмный фон
    modal.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Закрытие по Escape
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("nameInput").value.trim();
        const email = document.getElementById("emailInput").value.trim();

        // Пароль нигде не сохраняется: это учебный прототип без сервера.
        const saved = saveUser({ name: name, email: email });

        if (!saved) {
            message.textContent = "Не удалось сохранить данные в браузере.";
            return;
        }

        form.reset();
        message.textContent = "Готово, " + name + "! Данные сохранены в этом браузере.";
        updateButton();

        setTimeout(closeModal, 1200);
    });

    updateButton();
}


// ================================
// ЗАПУСК
// ================================

function startApplication() {
    try {
        initMap();
    } catch (error) {
        console.error("Не удалось создать карту:", error);
        showMessage("Не удалось создать карту. Проверьте API-ключ Яндекс Карт.", "error");
    }

    setupForm();
    setupCityChange();
}

// Вход и форма работают независимо от карты
setupAuth();

if (typeof ymaps !== "undefined") {
    ymaps.ready(startApplication);
} else {
    console.error("Яндекс Карты API не загрузился.");
    showMessage("Не удалось загрузить Яндекс Карты. Проверьте API-ключ и интернет.", "error");
    setupForm();
    setupCityChange();
}
