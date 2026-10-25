(function () {
  'use strict';

  var STORAGE_KEY = 'todo-mvp.v1';

  var MSG = {
    inputEmpty: '할 일을 입력해 주세요.',
    inputLong: '할 일은 100자 이내로 입력해 주세요.',
    jsonFail: '저장된 데이터를 불러오지 못했습니다. 새 목록으로 시작합니다.',
    formatFail: '저장된 데이터 형식을 확인할 수 없어 새 목록으로 시작합니다.',
    partial: '일부 저장 항목을 불러오지 못했습니다.',
    readFail:
      '브라우저 저장소에 접근할 수 없습니다. 새로고침하면 변경사항이 사라질 수 있습니다.',
    writeFail: '변경사항을 저장하지 못했습니다. 새로고침하면 사라질 수 있습니다.',
  };

  var form = document.getElementById('todo-form');
  var inputEl = document.getElementById('todo-input');
  var inputErrorEl = document.getElementById('input-error');
  var statsEl = document.getElementById('stats');
  var emptyStateEl = document.getElementById('empty-state');
  var listEl = document.getElementById('todo-list');
  var storageMessageEl = document.getElementById('storage-message');

  var todos = [];
  var inputError = '';
  var storageMessage = '';
  var storageReadFailed = false;
  var pendingFocus = { type: 'input' };

  function textLength(str) {
    return Array.from(String(str).trim()).length;
  }

  function validateTodoText(raw) {
    var trimmed = String(raw).trim();
    if (trimmed.length === 0) {
      return MSG.inputEmpty;
    }
    if (textLength(raw) > 100) {
      return MSG.inputLong;
    }
    return null;
  }

  function normalizeTodoItem(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      return null;
    }
    if (typeof raw.text !== 'string') {
      return null;
    }
    var text = raw.text.trim();
    if (textLength(text) < 1 || textLength(text) > 100) {
      return null;
    }
    if (raw.completed !== true && raw.completed !== false) {
      return null;
    }
    return { id: raw.id, text: text, completed: raw.completed };
  }

  function getStorage() {
    try {
      var storage = window.localStorage;
      if (storage == null) {
        return undefined;
      }
      return storage;
    } catch (e) {
      return undefined;
    }
  }

  function loadState() {
    var storage = getStorage();
    if (storage === undefined) {
      todos = [];
      storageReadFailed = true;
      storageMessage = MSG.readFail;
      return;
    }

    storageReadFailed = false;
    var raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      todos = [];
      storageReadFailed = true;
      storageMessage = MSG.readFail;
      return;
    }

    if (raw === null) {
      todos = [];
      storageMessage = '';
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      todos = [];
      storageMessage = MSG.jsonFail;
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      todos = [];
      storageMessage = MSG.formatFail;
      return;
    }

    if (parsed.version !== 1) {
      todos = [];
      storageMessage = MSG.formatFail;
      return;
    }

    if (!Array.isArray(parsed.todos)) {
      todos = [];
      storageMessage = MSG.formatFail;
      return;
    }

    var next = [];
    var seenIds = Object.create(null);
    var hadInvalid = false;

    for (var i = 0; i < parsed.todos.length; i++) {
      var item = normalizeTodoItem(parsed.todos[i]);
      if (!item) {
        hadInvalid = true;
        continue;
      }
      if (seenIds[item.id]) {
        hadInvalid = true;
        continue;
      }
      seenIds[item.id] = true;
      next.push(item);
    }

    todos = next;
    if (hadInvalid) {
      storageMessage = MSG.partial;
    } else {
      storageMessage = '';
    }
  }

  function generateId() {
    var existing = Object.create(null);
    for (var i = 0; i < todos.length; i++) {
      existing[todos[i].id] = true;
    }
    var attempt = 0;
    var id;
    do {
      id = 'todo-' + Date.now().toString(36) + (attempt > 0 ? '-' + attempt : '');
      attempt += 1;
    } while (existing[id]);
    return id;
  }

  function saveState() {
    var storage = getStorage();
    if (storage === undefined) {
      if (!storageReadFailed) {
        storageMessage = MSG.writeFail;
        updateStorageMessage();
      }
      return false;
    }

    try {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, todos: todos })
      );
      if (!storageReadFailed) {
        storageMessage = '';
        updateStorageMessage();
      }
      return true;
    } catch (e) {
      if (!storageReadFailed) {
        storageMessage = MSG.writeFail;
        updateStorageMessage();
      }
      return false;
    }
  }

  function completedCount() {
    var n = 0;
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].completed) {
        n += 1;
      }
    }
    return n;
  }

  function findTodoIndex(id) {
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  function setInputError(message) {
    inputError = message || '';
    if (inputError) {
      inputErrorEl.textContent = '';
      inputErrorEl.textContent = inputError;
      inputErrorEl.hidden = false;
      inputEl.setAttribute('aria-invalid', 'true');
      inputEl.setAttribute('aria-describedby', 'input-error');
    } else {
      inputErrorEl.textContent = '';
      inputErrorEl.hidden = true;
      inputEl.removeAttribute('aria-invalid');
      inputEl.removeAttribute('aria-describedby');
    }
  }

  function updateStorageMessage() {
    var text = storageMessage;
    storageMessageEl.textContent = '';
    storageMessageEl.textContent = text;
  }

  function buildListItem(todo) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' todo-item--completed' : '');
    li.setAttribute('data-id', todo.id);

    var label = document.createElement('label');
    label.className = 'todo-item__toggle';

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-item__checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('data-id', todo.id);

    var textSpan = document.createElement('span');
    textSpan.className = 'todo-item__text';
    textSpan.textContent = todo.text;

    label.appendChild(checkbox);
    label.appendChild(textSpan);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'todo-item__delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.setAttribute('data-id', todo.id);
    deleteBtn.setAttribute('aria-label', todo.text + ' 삭제');

    li.appendChild(label);
    li.appendChild(deleteBtn);
    return li;
  }

  function restoreFocus() {
    var target = pendingFocus;
    pendingFocus = { type: 'input' };

    if (target.type === 'input') {
      inputEl.focus();
      return;
    }

    if (target.type === 'toggle') {
      var toggleBox = listEl.querySelector(
        'input.todo-item__checkbox[data-id="' + CSS.escape(target.id) + '"]'
      );
      if (toggleBox) {
        toggleBox.focus();
        return;
      }
    }

    if (target.type === 'deleteBtn') {
      var deleteBtn = listEl.querySelector(
        'button.todo-item__delete[data-id="' + CSS.escape(target.id) + '"]'
      );
      if (deleteBtn) {
        deleteBtn.focus();
        return;
      }
      inputEl.focus();
      return;
    }

    inputEl.focus();
  }

  function render() {
    var total = todos.length;
    var done = completedCount();
    statsEl.textContent = '완료 ' + done + '건 / 전체 ' + total + '건';

    setInputError(inputError);
    updateStorageMessage();

    if (total === 0) {
      emptyStateEl.hidden = false;
      listEl.hidden = true;
      listEl.replaceChildren();
    } else {
      emptyStateEl.hidden = true;
      listEl.hidden = false;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < todos.length; i++) {
        frag.appendChild(buildListItem(todos[i]));
      }
      listEl.replaceChildren(frag);
    }

    restoreFocus();
  }

  function mutateAndPersist(focusAfter) {
    pendingFocus = focusAfter;
    render();
    saveState();
  }

  function handleSubmit(event) {
    event.preventDefault();
    var raw = inputEl.value;
    var error = validateTodoText(raw);
    if (error) {
      inputError = error;
      pendingFocus = { type: 'input' };
      render();
      return;
    }

    var text = raw.trim();
    todos.push({
      id: generateId(),
      text: text,
      completed: false,
    });
    inputEl.value = '';
    inputError = '';
    pendingFocus = { type: 'input' };
    mutateAndPersist({ type: 'input' });
  }

  function handleInput() {
    if (inputError) {
      inputError = '';
      setInputError('');
    }
  }

  function handleListChange(event) {
    var target = event.target;
    if (target.type !== 'checkbox' || !target.classList.contains('todo-item__checkbox')) {
      return;
    }
    var id = target.getAttribute('data-id');
    if (!id) {
      return;
    }
    var idx = findTodoIndex(id);
    if (idx === -1) {
      return;
    }
    todos[idx].completed = !todos[idx].completed;
    mutateAndPersist({ type: 'toggle', id: id });
  }

  function handleListClick(event) {
    var target = event.target;
    if (!target.classList.contains('todo-item__delete')) {
      return;
    }
    var id = target.getAttribute('data-id');
    if (!id) {
      return;
    }
    var idx = findTodoIndex(id);
    if (idx === -1) {
      return;
    }
    var focusAfter;
    if (todos[idx + 1]) {
      focusAfter = { type: 'deleteBtn', id: todos[idx + 1].id };
    } else if (todos[idx - 1]) {
      focusAfter = { type: 'deleteBtn', id: todos[idx - 1].id };
    } else {
      focusAfter = { type: 'input' };
    }
    todos.splice(idx, 1);
    mutateAndPersist(focusAfter);
  }

  form.addEventListener('submit', handleSubmit);
  inputEl.addEventListener('input', handleInput);
  listEl.addEventListener('change', handleListChange);
  listEl.addEventListener('click', handleListClick);

  loadState();
  pendingFocus = { type: 'input' };
  render();
})();
