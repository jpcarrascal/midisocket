/**
 * AUTOMATED TESTING GUIDE FOR BEGINNERS
 * Tests for sessionObj.js migration
 */

const { AllSessions } = require('../scripts/sessionObj.js');

describe('AllSessions - Basic Session Management', () => {
    let sessions;
    
    beforeEach(() => {
        sessions = new AllSessions(10);
    });

    test('should create AllSessions instance', () => {
        expect(sessions).toBeDefined();
        expect(sessions.sessions).toBeDefined();
    });

    test('should add a new session successfully', () => {
        sessions.addSession('test-session', 10, 16, 'random', 20);
        const session = sessions.select('test-session');
        expect(session).toBeTruthy();
        expect(session.name).toBe('test-session');
    });

    test('should return default session for non-existent session', () => {
        // Note: sessionObj creates a default session at index -1
        const session = sessions.select('doesnt-exist');
        // It returns default session, not undefined
        expect(session).toBeDefined();
        expect(session.name).toBe('default');
    });
});

describe('Session - Participant Management', () => {
    let sessions;
    let session;

    beforeEach(() => {
        sessions = new AllSessions(10);
        sessions.addSession('test-session', 10, 16, 'random', 20);
        session = sessions.select('test-session');
    });

    test('should allocate participant to available track', () => {
        const track = session.allocateAvailableParticipant('socket123', 'Alice');
        expect(track).toBeGreaterThanOrEqual(0);
        expect(track).toBeLessThan(10);
    });

    test('should get participant initials', () => {
        session.allocateAvailableParticipant('socket123', 'Alice');
        const initials = session.getParticipantInitials('socket123');
        expect(initials).toBe('Alice');
    });

    test('should release participant when they disconnect', () => {
        const track = session.allocateAvailableParticipant('socket123', 'Alice');
        expect(session.getParticipantNumber('socket123')).toBe(track);
        
        session.releaseParticipant('socket123');
        expect(session.getParticipantNumber('socket123')).toBe(-1);
    });
});

describe('Migration Verification - New API', () => {
    test('should work with direct-access API', () => {
        const sessions = new AllSessions(10);
        sessions.addSession('test', 10, 16, 'random', 20);
        const session = sessions.select('test');
        
        expect(session).toBeTruthy();
        session.setSeqID('seq123');
        expect(session.isReady()).toBe(true);
        
        const track = session.allocateAvailableParticipant('socket1', 'Alice');
        expect(track).toBeGreaterThanOrEqual(0);
    });

    test('Non-existing sessions seportee correctly', () => {
        const sessions = new AllSessions(10);
        sessions.addSession('test', 10, 16, 'random', 20);
        const session = sessions.select('nonexistent');
        
        expect(session).toBeGreaterThanOrEqual(0); // Default session
    });

});
