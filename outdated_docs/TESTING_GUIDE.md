# Testing Guide for Beginners

## What is Automated Testing?

Automated testing is like having a robot check your homework. Instead of manually testing your application by clicking buttons and checking if things work, you write code that automatically tests your code.

## Why Do We Test?

1. **Catch bugs early** - Find problems before users do
2. **Confidence in changes** - Make changes knowing you won't break things
3. **Documentation** - Tests show how code should behave
4. **Save time** - Automated tests run faster than manual testing

## Understanding Our Tests

### The Test File Structure

Our test file (`tests/sessionObj.test.js`) is organized into sections:

```javascript
describe('Group Name', () => {
    // A group of related tests
    
    test('what this test does', () => {
        // The actual test code
    });
});
```

### Key Testing Concepts

#### 1. **describe()** - Grouping Tests
Groups related tests together, like chapters in a book.

```javascript
describe('Session - Participant Management', () => {
    // All tests about participants go here
});
```

#### 2. **beforeEach()** - Setup
Runs before each test to give a fresh start.

```javascript
beforeEach(() => {
    sessions = new AllSessions(10);  // Create new object for each test
});
```

This is important! Without it, tests could affect each other.

#### 3. **test()** or **it()** - Individual Tests
Each test checks one specific thing.

```javascript
test('should allocate participant to available track', () => {
    const track = session.allocateAvailableParticipant('socket123', 'Alice');
    expect(track).toBeGreaterThanOrEqual(0);
});
```

#### 4. **expect()** - Making Assertions
This is where you check if something is correct.

```javascript
expect(actual).toBe(expected);        // Check if values are exactly equal
expect(actual).toEqual(expected);     // Check if objects are equal
expect(actual).toBeTruthy();          // Check if value exists (not null/undefined/false)
expect(actual).toBeDefined();         // Check if value is defined
expect(actual).toBeGreaterThan(5);    // Check if number > 5
```

## Running the Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run with more details
npm test -- --verbose

# Run tests and watch for changes (re-runs automatically)
npm test -- --watch

# Run a specific test file
npm test sessionObj.test.js
```

### Understanding Test Output

When you run `npm test`, you'll see:

```
✓ should create AllSessions instance (1 ms)
✓ should add a new session successfully (1 ms)
✓ should allocate participant to available track
```

- **✓ (green checkmark)** = Test PASSED ✅
- **✗ (red X)** = Test FAILED ❌
- **(1 ms)** = How long the test took

### When a Test Fails

If a test fails, Jest shows you exactly what went wrong:

```
● Session - Participant Management › should get participant initials

  expect(received).toBe(expected)

  Expected: "Alice"
  Received: undefined

    at Object.toBe (tests/sessionObj.test.js:65:25)
```

This tells you:
- **Which test failed**: "should get participant initials"
- **What was wrong**: Expected "Alice" but got undefined
- **Where**: Line 65 in the test file

## Our Migration Tests

### What We're Testing

After migrating from the old `sessionsObj.js` to the new `sessionObj.js`, we need to verify:

1. ✅ Sessions can be created
2. ✅ Participants can join sessions
3. ✅ Participants can be tracked (by socket ID)
4. ✅ Participants can leave (disconnect)
5. ✅ The new API works correctly (`sessions.select(name).method()`)

### Test Breakdown

#### Test 1: Create AllSessions
```javascript
test('should create AllSessions instance', () => {
    expect(sessions).toBeDefined();
    expect(sessions.sessions).toBeDefined();
});
```
**What it checks**: Can we create the main sessions manager?

#### Test 2: Add a Session
```javascript
test('should add a new session successfully', () => {
    sessions.addSession('test-session', 10, 16, 'random', 20);
    const session = sessions.select('test-session');
    expect(session).toBeTruthy();
    expect(session.name).toBe('test-session');
});
```
**What it checks**: Can we create a new session and find it?

#### Test 3: Allocate Participant
```javascript
test('should allocate participant to available track', () => {
    const track = session.allocateAvailableParticipant('socket123', 'Alice');
    expect(track).toBeGreaterThanOrEqual(0);
    expect(track).toBeLessThan(10);
});
```
**What it checks**: When a user joins, do they get a valid track number (0-9)?

#### Test 4: Track Participant
```javascript
test('should get participant initials', () => {
    session.allocateAvailableParticipant('socket123', 'Alice');
    const initials = session.getParticipantInitials('socket123');
    expect(initials).toBe('Alice');
});
```
**What it checks**: Can we remember who's on which track?

#### Test 5: Release Participant
```javascript
test('should release participant when they disconnect', () => {
    const track = session.allocateAvailableParticipant('socket123', 'Alice');
    expect(session.getParticipantNumber('socket123')).toBe(track);
    
    session.releaseParticipant('socket123');
    expect(session.getParticipantNumber('socket123')).toBe(-1);
});
```
**What it checks**: When a user leaves, is their track freed up?

#### Test 6: New API Works
```javascript
test('should work with direct-access API', () => {
    const sessions = new AllSessions(10);
    sessions.addSession('test', 10, 16, 'random', 20);
    const session = sessions.select('test');  // NEW WAY
    
    expect(session).toBeTruthy();
    session.setSeqID('seq123');               // Direct access
    expect(session.isReady()).toBe(true);
});
```
**What it checks**: Does the new `sessions.select(name).method()` pattern work?

## Writing Your Own Tests

### Recipe for a Good Test

1. **Setup** - Create what you need
2. **Action** - Do something
3. **Assert** - Check if it worked

Example:
```javascript
test('should do something useful', () => {
    // 1. SETUP
    const sessions = new AllSessions(10);
    sessions.addSession('my-test', 10, 16, 'random', 20);
    const session = sessions.select('my-test');
    
    // 2. ACTION
    const track = session.allocateAvailableParticipant('socket1', 'Bob');
    
    // 3. ASSERT
    expect(track).toBeGreaterThanOrEqual(0);
    expect(session.getParticipantInitials('socket1')).toBe('Bob');
});
```

### Test Naming Convention

Use clear, descriptive names:
- ✅ GOOD: `test('should allocate participant to available track')`
- ❌ BAD: `test('test1')`

The name should complete the sentence: "It should..."

## Common Issues and Solutions

### Issue 1: Tests Pass Individually but Fail Together

**Problem**: One test affects another.

**Solution**: Use `beforeEach()` to reset state:
```javascript
beforeEach(() => {
    sessions = new AllSessions(10);  // Fresh start for each test
});
```

### Issue 2: Async Operations

**Problem**: Test finishes before async operation completes.

**Solution**: Use async/await:
```javascript
test('should handle async operation', async () => {
    const result = await someAsyncFunction();
    expect(result).toBeDefined();
});
```

### Issue 3: Testing Real Socket.IO

**Problem**: Hard to test actual socket connections.

**Solution**: Test the session logic separately (like we do), then do manual/integration testing for sockets.

## Migration Verification Checklist

After running tests, verify manually:

- [ ] Start the server: `node index.js`
- [ ] Open sequencer in browser: `http://localhost:3000/sequencer?session=test`
- [ ] Check console - no errors
- [ ] Open track in another browser: `http://localhost:3000/track?session=test&initials=Alice`
- [ ] Check both consoles - participants should connect
- [ ] Try playing/stopping music
- [ ] Check server logs - everything working

## Best Practices

1. **Keep tests simple** - One test = one thing
2. **Test behavior, not implementation** - Test what it does, not how it does it
3. **Use descriptive names** - Anyone should understand what's being tested
4. **Don't test external libraries** - Trust that Socket.IO works
5. **Run tests often** - Before committing code

## Next Steps

Once comfortable with these tests, you can:

1. Add more tests for edge cases
2. Test the Sequencer class methods
3. Add integration tests with actual Socket.IO connections
4. Set up continuous integration (run tests automatically on commit)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- Run `npm test -- --help` to see all Jest options

## Summary

**Testing is like a safety net** - it catches you when you make mistakes. The small time investment in writing tests pays off hugely when you:
- Refactor code
- Add new features
- Fix bugs
- Work in a team

Your tests are now your proof that the migration from `sessionsObj.js` to `sessionObj.js` worked correctly! 🎉
